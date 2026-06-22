-- Private Group DMs, separate from Discord-style servers/channels.
create table if not exists public.group_chats (
  id uuid primary key default gen_random_uuid(),
  name text,
  icon_url text,
  owner_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (name is null or length(trim(name)) between 1 and 40)
);

create table if not exists public.group_chat_members (
  group_chat_id uuid not null references public.group_chats (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_chat_id, user_id)
);

alter table public.messages
  add column if not exists group_chat_id uuid references public.group_chats (id) on delete cascade;
create index if not exists messages_group_chat_created_idx
  on public.messages (group_chat_id, created_at);

alter table public.group_chats enable row level security;
alter table public.group_chat_members enable row level security;

create or replace function public.is_group_chat_member(target_group_chat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_chat_members
    where group_chat_id = target_group_chat and user_id = auth.uid()
  );
$$;

drop policy if exists group_chats_select_member on public.group_chats;
create policy group_chats_select_member on public.group_chats
  for select to authenticated using (public.is_group_chat_member(id));
drop policy if exists group_chats_update_member on public.group_chats;
create policy group_chats_update_member on public.group_chats
  for update to authenticated
  using (public.is_group_chat_member(id))
  with check (public.is_group_chat_member(id));
drop policy if exists group_chats_delete_owner on public.group_chats;
create policy group_chats_delete_owner on public.group_chats
  for delete to authenticated using (owner_id = auth.uid());
drop policy if exists group_chat_members_select_member on public.group_chat_members;
create policy group_chat_members_select_member on public.group_chat_members
  for select to authenticated using (public.is_group_chat_member(group_chat_id));

drop policy if exists messages_select_authenticated on public.messages;
create policy messages_select_authenticated on public.messages
  for select to authenticated using (
    (channel_id is not null and public.can_access_channel(channel_id))
    or (friend_id is not null and exists (
      select 1 from public.friends
      where id = friend_id and status = 'accepted'
        and (user_id_1 = auth.uid() or user_id_2 = auth.uid())
    ))
    or (group_chat_id is not null and public.is_group_chat_member(group_chat_id))
  );

drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own on public.messages
  for insert to authenticated with check (
    auth.uid() = sender_id and (
      (channel_id is not null and public.can_access_channel(channel_id))
      or (friend_id is not null and exists (
        select 1 from public.friends
        where id = friend_id and status = 'accepted'
          and (user_id_1 = auth.uid() or user_id_2 = auth.uid())
      ))
      or (group_chat_id is not null and public.is_group_chat_member(group_chat_id))
    )
  );

create or replace function public.create_group_chat(group_name text, member_ids uuid[])
returns public.group_chats
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.group_chats;
  clean_name text := nullif(trim(group_name), '');
  clean_member_ids uuid[];
  member_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select coalesce(array_agg(distinct candidate), '{}'::uuid[])
  into clean_member_ids
  from unnest(coalesce(member_ids, '{}'::uuid[])) candidate
  where candidate <> auth.uid();
  member_count := cardinality(clean_member_ids);
  if member_count < 1 or member_count > 9 then
    raise exception 'Select between 1 and 9 friends';
  end if;
  if clean_name is not null and length(clean_name) > 40 then
    raise exception 'Group name must be 40 characters or fewer';
  end if;
  if exists (
    select 1 from unnest(clean_member_ids) candidate
    where not exists (
      select 1 from public.friends
      where status = 'accepted'
        and ((user_id_1 = auth.uid() and user_id_2 = candidate)
          or (user_id_1 = candidate and user_id_2 = auth.uid()))
    )
  ) then
    raise exception 'Only accepted friends can join a group chat';
  end if;
  insert into public.group_chats (name, owner_id)
  values (clean_name, auth.uid()) returning * into created;
  insert into public.group_chat_members (group_chat_id, user_id)
  values (created.id, auth.uid());
  insert into public.group_chat_members (group_chat_id, user_id)
  select created.id, candidate from unnest(clean_member_ids) candidate;
  return created;
end;
$$;

revoke execute on function public.create_group_chat(text, uuid[]) from public, anon;
grant execute on function public.create_group_chat(text, uuid[]) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['group_chats', 'group_chat_members'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
