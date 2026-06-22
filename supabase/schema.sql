-- =====================================================================
-- Better-VC — Phase 2 schema (Supabase / PostgreSQL)
-- Run this in the Supabase Dashboard → SQL Editor.
-- Safe to re-run (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- USERS — public profile, mirrors auth.users
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique not null,
  avatar_url  text,
  status      text not null default 'online'
              check (status in ('online', 'away', 'busy', 'offline')),
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- SERVERS
-- ---------------------------------------------------------------------
create table if not exists public.servers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  icon_url    text,
  owner_id    uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SERVER MEMBERS — Discord-like communities and roles
-- ---------------------------------------------------------------------
create table if not exists public.server_members (
  server_id   uuid not null references public.servers (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  role        text not null default 'member'
              check (role in ('owner', 'admin', 'member')),
  joined_at   timestamptz not null default now(),
  primary key (server_id, user_id)
);

-- ---------------------------------------------------------------------
-- CHANNELS
-- ---------------------------------------------------------------------
create table if not exists public.channels (
  id          uuid primary key default gen_random_uuid(),
  server_id   uuid references public.servers (id) on delete cascade,
  name        text not null,
  type        text not null default 'text' check (type in ('text', 'voice')),
  created_at  timestamptz not null default now(),
  unique (server_id, name)
);

-- ---------------------------------------------------------------------
-- FRIENDS
-- ---------------------------------------------------------------------
create table if not exists public.friends (
  id          uuid primary key default gen_random_uuid(),
  user_id_1   uuid not null references public.users (id) on delete cascade,
  user_id_2   uuid not null references public.users (id) on delete cascade,
  status      text not null default 'pending'
              check (status in ('pending', 'accepted', 'blocked')),
  created_at  timestamptz not null default now(),
  unique (user_id_1, user_id_2)
);
create unique index if not exists friends_pair_unique_idx
  on public.friends (
    least(user_id_1::text, user_id_2::text),
    greatest(user_id_1::text, user_id_2::text)
  );

-- ---------------------------------------------------------------------
-- GROUP CHATS — private Discord-style group DMs (not server channels)
-- ---------------------------------------------------------------------
create table if not exists public.group_chats (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  icon_url    text,
  owner_id    uuid not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  check (name is null or length(trim(name)) between 1 and 40)
);

create table if not exists public.group_chat_members (
  group_chat_id uuid not null references public.group_chats (id) on delete cascade,
  user_id       uuid not null references public.users (id) on delete cascade,
  joined_at     timestamptz not null default now(),
  primary key (group_chat_id, user_id)
);

-- ---------------------------------------------------------------------
-- MESSAGES
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid references public.channels (id) on delete cascade,
  friend_id   uuid references public.friends (id) on delete cascade,
  group_chat_id uuid references public.group_chats (id) on delete cascade,
  sender_id   uuid not null references public.users (id) on delete cascade,
  content     text not null default '',
  media_url   text,
  created_at  timestamptz not null default now()
);
alter table public.messages
  add column if not exists group_chat_id uuid references public.group_chats (id) on delete cascade;
create index if not exists messages_channel_created_idx
  on public.messages (channel_id, created_at);
create index if not exists messages_group_chat_created_idx
  on public.messages (group_chat_id, created_at);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.users    enable row level security;
alter table public.servers  enable row level security;
alter table public.server_members enable row level security;
alter table public.channels enable row level security;
alter table public.friends  enable row level security;
alter table public.group_chats enable row level security;
alter table public.group_chat_members enable row level security;
alter table public.messages enable row level security;

-- USERS: any authenticated user can read; you can edit only your own row.
drop policy if exists users_select_authenticated on public.users;
create policy users_select_authenticated on public.users
  for select to authenticated using (true);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Membership helpers are SECURITY DEFINER to avoid recursive RLS checks.
create or replace function public.is_server_member(target_server uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.server_members
    where server_id = target_server and user_id = auth.uid()
  );
$$;

create or replace function public.can_access_server(target_server uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.servers
    where id = target_server
      and (owner_id is null or owner_id = auth.uid())
  ) or public.is_server_member(target_server);
$$;

create or replace function public.can_manage_server(target_server uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.servers where id = target_server and owner_id = auth.uid()
  ) or exists (
    select 1 from public.server_members
    where server_id = target_server
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.can_access_channel(target_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.channels
    where id = target_channel
      and public.can_access_server(server_id)
  );
$$;

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

-- SERVERS / CHANNELS: users see public seed servers and their own communities.
drop policy if exists servers_select_authenticated on public.servers;
create policy servers_select_authenticated on public.servers
  for select to authenticated
  using (owner_id is null or owner_id = auth.uid() or public.is_server_member(id));

drop policy if exists servers_insert_own on public.servers;
create policy servers_insert_own on public.servers
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists servers_update_manage on public.servers;
create policy servers_update_manage on public.servers
  for update to authenticated using (public.can_manage_server(id));

drop policy if exists server_members_select_same_server on public.server_members;
create policy server_members_select_same_server on public.server_members
  for select to authenticated using (public.can_access_server(server_id));

drop policy if exists channels_select_authenticated on public.channels;
create policy channels_select_authenticated on public.channels
  for select to authenticated using (public.can_access_server(server_id));

drop policy if exists channels_insert_manage on public.channels;
create policy channels_insert_manage on public.channels
  for insert to authenticated with check (public.can_manage_server(server_id));

drop policy if exists channels_update_manage on public.channels;
create policy channels_update_manage on public.channels
  for update to authenticated using (public.can_manage_server(server_id));

drop policy if exists channels_delete_manage on public.channels;
create policy channels_delete_manage on public.channels
  for delete to authenticated using (public.can_manage_server(server_id));

-- GROUP CHATS: only participants can see the conversation and roster.
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

-- MESSAGES: only members can read/write server channels.
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

drop policy if exists messages_update_own on public.messages;
create policy messages_update_own on public.messages
  for update to authenticated using (auth.uid() = sender_id);

drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own on public.messages
  for delete to authenticated using (auth.uid() = sender_id);

-- FRIENDS: only the two parties can see/manage the row.
drop policy if exists friends_select_involved on public.friends;
create policy friends_select_involved on public.friends
  for select to authenticated
  using (auth.uid() = user_id_1 or auth.uid() = user_id_2);

drop policy if exists friends_insert_self on public.friends;
create policy friends_insert_self on public.friends
  for insert to authenticated with check (auth.uid() = user_id_1);

drop policy if exists friends_update_involved on public.friends;
create policy friends_update_involved on public.friends
  for update to authenticated
  using (auth.uid() = user_id_2)
  with check (auth.uid() = user_id_2);

drop policy if exists friends_delete_involved on public.friends;
create policy friends_delete_involved on public.friends
  for delete to authenticated
  using (auth.uid() = user_id_1 or auth.uid() = user_id_2);

-- =====================================================================
-- RPCs — atomic server and friend workflows used by the desktop client
-- =====================================================================
create or replace function public.create_server(server_name text)
returns public.servers
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.servers;
  clean_name text := trim(server_name);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(clean_name) < 2 or length(clean_name) > 40 then
    raise exception 'Server name must be between 2 and 40 characters';
  end if;

  insert into public.servers (name, owner_id)
  values (clean_name, auth.uid()) returning * into created;
  insert into public.server_members (server_id, user_id, role)
  values (created.id, auth.uid(), 'owner');
  insert into public.channels (server_id, name, type) values
    (created.id, 'general', 'text'),
    (created.id, 'General Voice', 'voice');
  return created;
end;
$$;

create or replace function public.send_friend_request(target_username text)
returns public.friends
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  created public.friends;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into target_id from public.users
  where lower(username) = lower(trim(target_username));
  if target_id is null then raise exception 'User not found'; end if;
  if target_id = auth.uid() then raise exception 'You cannot add yourself'; end if;
  if exists (
    select 1 from public.friends
    where (user_id_1 = auth.uid() and user_id_2 = target_id)
       or (user_id_1 = target_id and user_id_2 = auth.uid())
  ) then raise exception 'A friend request or friendship already exists'; end if;

  insert into public.friends (user_id_1, user_id_2, status)
  values (auth.uid(), target_id, 'pending') returning * into created;
  return created;
end;
$$;

create or replace function public.respond_friend_request(request_id uuid, accept_request boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.friends
    where id = request_id and user_id_2 = auth.uid() and status = 'pending'
  ) then raise exception 'Friend request not found'; end if;
  if accept_request then
    update public.friends set status = 'accepted' where id = request_id;
  else
    delete from public.friends where id = request_id;
  end if;
end;
$$;

create or replace function public.add_server_member(target_server uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_server(target_server) then
    raise exception 'You cannot manage this server';
  end if;
  if not exists (
    select 1 from public.friends
    where status = 'accepted'
      and ((user_id_1 = auth.uid() and user_id_2 = target_user)
        or (user_id_1 = target_user and user_id_2 = auth.uid()))
  ) then raise exception 'Only accepted friends can be added'; end if;
  insert into public.server_members (server_id, user_id, role)
  values (target_server, target_user, 'member')
  on conflict (server_id, user_id) do nothing;
end;
$$;

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
    select 1
    from unnest(clean_member_ids) candidate
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
  values (clean_name, auth.uid())
  returning * into created;

  insert into public.group_chat_members (group_chat_id, user_id)
  values (created.id, auth.uid());

  insert into public.group_chat_members (group_chat_id, user_id)
  select created.id, candidate from unnest(clean_member_ids) candidate;

  return created;
end;
$$;

revoke execute on function public.create_server(text) from public, anon;
revoke execute on function public.send_friend_request(text) from public, anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.add_server_member(uuid, uuid) from public, anon;
revoke execute on function public.create_group_chat(text, uuid[]) from public, anon;
grant execute on function public.create_server(text) to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.add_server_member(uuid, uuid) to authenticated;
grant execute on function public.create_group_chat(text, uuid[]) to authenticated;

-- =====================================================================
-- REALTIME — broadcast row changes for live chat
-- =====================================================================
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['friends', 'servers', 'channels', 'server_members', 'group_chats', 'group_chat_members'] loop
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

-- =====================================================================
-- SEED — default server + text channels (matches the UI sidebar)
-- =====================================================================
insert into public.servers (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Rust Dev')
on conflict (id) do nothing;

insert into public.channels (server_id, name, type) values
  ('00000000-0000-0000-0000-000000000001', 'general-discussion', 'text'),
  ('00000000-0000-0000-0000-000000000001', 'rust-dev',           'text'),
  ('00000000-0000-0000-0000-000000000001', 'linux-kernel',       'text'),
  ('00000000-0000-0000-0000-000000000001', 'sysadmin',           'text'),
  ('00000000-0000-0000-0000-000000000001', 'voice-general',      'voice'),
  ('00000000-0000-0000-0000-000000000001', 'voice-gaming',       'voice')
on conflict (server_id, name) do nothing;
