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

-- ---------------------------------------------------------------------
-- MESSAGES
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid references public.channels (id) on delete cascade,
  friend_id   uuid references public.friends (id) on delete cascade,
  sender_id   uuid not null references public.users (id) on delete cascade,
  content     text not null default '',
  media_url   text,
  created_at  timestamptz not null default now()
);
create index if not exists messages_channel_created_idx
  on public.messages (channel_id, created_at);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.users    enable row level security;
alter table public.servers  enable row level security;
alter table public.channels enable row level security;
alter table public.friends  enable row level security;
alter table public.messages enable row level security;

-- USERS: any authenticated user can read; you can edit only your own row.
drop policy if exists users_select_authenticated on public.users;
create policy users_select_authenticated on public.users
  for select to authenticated using (true);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- SERVERS / CHANNELS: readable by authenticated users (Phase 2 = one community).
drop policy if exists servers_select_authenticated on public.servers;
create policy servers_select_authenticated on public.servers
  for select to authenticated using (true);

drop policy if exists channels_select_authenticated on public.channels;
create policy channels_select_authenticated on public.channels
  for select to authenticated using (true);

-- MESSAGES: read all; insert/edit/delete only your own.
drop policy if exists messages_select_authenticated on public.messages;
create policy messages_select_authenticated on public.messages
  for select to authenticated using (true);

drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own on public.messages
  for insert to authenticated with check (auth.uid() = sender_id);

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
  using (auth.uid() = user_id_1 or auth.uid() = user_id_2);

-- =====================================================================
-- REALTIME — broadcast row changes for live chat
-- =====================================================================
alter publication supabase_realtime add table public.messages;

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
  ('00000000-0000-0000-0000-000000000001', 'sysadmin',           'text')
on conflict (server_id, name) do nothing;
