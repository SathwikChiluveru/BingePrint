-- Autoplayed schema

create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid references auth.users(id),
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at  timestamptz default now()
);

create table if not exists members (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid references groups(id) on delete cascade,
  user_id      uuid references auth.users(id),
  nickname     text not null,
  wrapped_data jsonb not null,
  created_at   timestamptz default now()
);

-- Indexes
create index if not exists members_group_id_idx on members(group_id);
create index if not exists groups_invite_code_idx on groups(invite_code);

-- Row-level security
alter table groups  enable row level security;
alter table members enable row level security;

-- Groups: anyone can read; only authenticated owner can create/delete
create policy "public read groups"
  on groups for select using (true);

create policy "owner insert groups"
  on groups for insert
  with check (auth.uid() = owner_id);

create policy "owner delete groups"
  on groups for delete
  using (auth.uid() = owner_id);

-- Members: anyone can read; authenticated users can insert/delete own rows
create policy "public read members"
  on members for select using (true);

create policy "self insert members"
  on members for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "self delete members"
  on members for delete
  using (auth.uid() = user_id);
