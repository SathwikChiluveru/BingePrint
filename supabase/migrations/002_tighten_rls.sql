-- 002_tighten_rls.sql
--
-- Locks group data down to the people in the group. Safe to run more than once.
--
-- Before: anyone holding the public anon key could read every group and every member's
-- wrapped_data (`using (true)`), insert anonymous members (user_id null) into any group, and
-- invite codes were 8 hex chars from md5(random()) (32 bits, non-cryptographic RNG).
--
-- After:
--   * groups:  readable by the owner and by members only.
--   * members: readable by members of the same group and by the group owner only.
--   * Invite-code lookup goes through group_by_invite_code() (signed-in users, rate limited),
--     which returns only id + name (+ the owner's teaser when they opted in).
--   * Joining goes through join_group() (needs the invite code unless you own the group).
--   * One membership per user per group (unique index).
--   * New invite codes: 10 chars from a 32-letter alphabet using gen_random_bytes (50 bits).
--     Existing 8-char codes keep working.
--   * groups.share_teaser / groups.owner_teaser for the opt-in inviter hook on the invite page.

-- pgcrypto lives in the `extensions` schema on Supabase
create extension if not exists pgcrypto with schema extensions;

------------------------------------------------------------------------------------------------
-- Columns
------------------------------------------------------------------------------------------------

alter table public.groups add column if not exists share_teaser boolean not null default false;
-- { "personality": text, "statLabel": text, "statValue": text } — small, shown only when share_teaser
alter table public.groups add column if not exists owner_teaser jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'groups_owner_teaser_size') then
    alter table public.groups
      add constraint groups_owner_teaser_size
      check (owner_teaser is null or pg_column_size(owner_teaser) <= 1024);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_name_length') then
    alter table public.groups
      add constraint groups_name_length check (char_length(name) between 1 and 60) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'members_nickname_length') then
    alter table public.members
      add constraint members_nickname_length check (char_length(nickname) between 1 and 30) not valid;
  end if;
  -- Server strips wrapped_data to a summary (~2 KB); 32 KB leaves headroom and blocks abuse
  if not exists (select 1 from pg_constraint where conname = 'members_wrapped_data_size') then
    alter table public.members
      add constraint members_wrapped_data_size check (pg_column_size(wrapped_data) <= 32768) not valid;
  end if;
end $$;

------------------------------------------------------------------------------------------------
-- Invite codes: cryptographically random, 10 chars, alphabet without l/o/0/1 look-alikes
------------------------------------------------------------------------------------------------

create or replace function public.gen_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'abcdefghijkmnpqrstuvwxyz23456789'; -- 32 chars, so byte % 32 is unbiased
  bytes bytea;
  code text;
begin
  loop
    bytes := extensions.gen_random_bytes(10);
    code := '';
    for i in 0..9 loop
      code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.groups g where g.invite_code = code);
  end loop;
  return code;
end;
$$;

-- Column defaults run as the inserting role, so signed-in users need EXECUTE (it only mints a code)
revoke all on function public.gen_invite_code() from public, anon;
grant execute on function public.gen_invite_code() to authenticated;

alter table public.groups alter column invite_code set default public.gen_invite_code();

------------------------------------------------------------------------------------------------
-- One membership per user per group. Drops any duplicate rows first (keeps the earliest);
-- the API already refused duplicates, so this normally deletes nothing.
------------------------------------------------------------------------------------------------

delete from public.members m
using public.members d
where m.user_id is not null
  and m.group_id = d.group_id
  and m.user_id = d.user_id
  and (m.created_at, m.id) > (d.created_at, d.id);

create unique index if not exists members_group_user_unique
  on public.members (group_id, user_id)
  where user_id is not null;

------------------------------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so policies can ask "is this user in the group?" without the
-- members policy recursively evaluating itself.
------------------------------------------------------------------------------------------------

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.group_id = gid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups g
    where g.id = gid and g.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.is_group_owner(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;

------------------------------------------------------------------------------------------------
-- Policies
------------------------------------------------------------------------------------------------

drop policy if exists "public read groups" on public.groups;
drop policy if exists "member read groups" on public.groups;
create policy "member read groups"
  on public.groups for select
  to authenticated
  using (owner_id = auth.uid() or public.is_group_member(id));

-- Kept from 001 (re-created so this file is self-contained)
drop policy if exists "owner insert groups" on public.groups;
create policy "owner insert groups"
  on public.groups for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "owner delete groups" on public.groups;
create policy "owner delete groups"
  on public.groups for delete
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "public read members" on public.members;
drop policy if exists "group read members" on public.members;
create policy "group read members"
  on public.members for select
  to authenticated
  using (public.is_group_member(group_id) or public.is_group_owner(group_id));

-- Direct inserts: only the owner adding themselves (POST /api/groups). Everyone else joins
-- through join_group(), which checks the invite code. No more anonymous (user_id null) rows.
drop policy if exists "self insert members" on public.members;
drop policy if exists "owner self insert members" on public.members;
create policy "owner self insert members"
  on public.members for insert
  to authenticated
  with check (auth.uid() = user_id and public.is_group_owner(group_id));

drop policy if exists "self delete members" on public.members;
create policy "self delete members"
  on public.members for delete
  to authenticated
  using (auth.uid() = user_id);

------------------------------------------------------------------------------------------------
-- Rate limiting for invite-code lookups (per signed-in user). The table has RLS on and no
-- policies, so only the SECURITY DEFINER function below can touch it.
------------------------------------------------------------------------------------------------

create table if not exists public.invite_lookup_attempts (
  user_id      uuid not null,
  attempted_at timestamptz not null default now()
);
create index if not exists invite_lookup_attempts_user_time_idx
  on public.invite_lookup_attempts (user_id, attempted_at);
alter table public.invite_lookup_attempts enable row level security;

------------------------------------------------------------------------------------------------
-- Invite lookup: the only way to read a group you are not in. Returns id + name, plus the
-- owner's teaser only when they opted in. 20 lookups per user per 10 minutes.
------------------------------------------------------------------------------------------------

drop function if exists public.group_by_invite_code(text);
create function public.group_by_invite_code(code text)
returns table (id uuid, name text, share_teaser boolean, owner_teaser jsonb)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  recent int;
begin
  if uid is null then
    raise exception 'sign_in_required' using errcode = 'PT401';
  end if;
  if code is null or code !~ '^[a-z0-9]{8,10}$' then
    return;
  end if;

  delete from public.invite_lookup_attempts a
  where a.user_id = uid and a.attempted_at < now() - interval '1 hour';

  select count(*) into recent
  from public.invite_lookup_attempts a
  where a.user_id = uid and a.attempted_at > now() - interval '10 minutes';
  if recent >= 20 then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;
  insert into public.invite_lookup_attempts (user_id) values (uid);

  return query
    select g.id,
           g.name,
           g.share_teaser,
           case when g.share_teaser then g.owner_teaser else null end
    from public.groups g
    where g.invite_code = code
    limit 1;
end;
$$;

revoke all on function public.group_by_invite_code(text) from public, anon;
grant execute on function public.group_by_invite_code(text) to authenticated;

------------------------------------------------------------------------------------------------
-- Join: needs the group's invite code (or ownership). Returns the new member row.
-- wrapped_data is already summarised and validated by the API route; this re-checks size.
------------------------------------------------------------------------------------------------

drop function if exists public.join_group(uuid, text, text, jsonb);
create function public.join_group(p_group_id uuid, p_invite_code text, p_nickname text, p_wrapped_data jsonb)
returns setof public.members
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g public.groups%rowtype;
begin
  if uid is null then
    raise exception 'sign_in_required' using errcode = 'PT401';
  end if;

  select * into g from public.groups where groups.id = p_group_id;
  if not found or (g.owner_id is distinct from uid and g.invite_code is distinct from p_invite_code) then
    raise exception 'group_not_found' using errcode = 'PT404';
  end if;

  if p_nickname is null or char_length(btrim(p_nickname)) not between 1 and 30 then
    raise exception 'invalid_nickname' using errcode = 'PT422';
  end if;
  if p_wrapped_data is null or jsonb_typeof(p_wrapped_data) <> 'object'
     or pg_column_size(p_wrapped_data) > 32768 then
    raise exception 'invalid_wrapped_data' using errcode = 'PT422';
  end if;

  -- unique index members_group_user_unique raises 23505 on a second join
  return query
    insert into public.members (group_id, user_id, nickname, wrapped_data)
    values (p_group_id, uid, btrim(p_nickname), p_wrapped_data)
    returning *;
end;
$$;

revoke all on function public.join_group(uuid, text, text, jsonb) from public, anon;
grant execute on function public.join_group(uuid, text, text, jsonb) to authenticated;
