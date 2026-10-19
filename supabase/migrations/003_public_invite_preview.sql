-- 003_public_invite_preview.sql
--
-- Lets a signed-out invitee see which group an invite code belongs to before any sign-in.
-- Run after 002_tighten_rls.sql. Safe to run more than once.
--
-- Adds public_invite_preview(code, client_key), callable by anon and authenticated. It returns
-- ONLY the group id, the group name, and the owner's teaser when the owner opted in
-- (groups.share_teaser). Never members, never wrapped_data, never the owner id.
--
-- Rate limiting (two layers in the database, plus one in the API):
--   1. API route (in-memory, per client IP): the first line, for normal traffic.
--   2. Per client key, here: 30 lookups per 10 minutes. The key is an opaque SHA-256 hex digest of
--      the caller's IP that the Next.js server computes and passes in; the raw IP never reaches the
--      database. Callers going through our API cannot choose their key.
--   3. Global, here: 600 lookups per minute across every caller.
--
-- Tradeoff: the anon key is public, so anyone can call this function directly through PostgREST
-- and pass any client_key (or rotate one per request). The per-key bucket therefore only binds
-- traffic that comes through our API; the global bucket is what bounds a direct caller. That is
-- enough here because a hit reveals only a group name and an opt-in teaser, and guessing a code
-- is out of reach: 10 chars from a 32-letter alphabet is 2^50 codes, so at 600 tries a minute
-- (the global ceiling) an attacker finds nothing in practice. Legacy 8-hex codes (2^32) are
-- weaker; at the global ceiling, finding any one of N legacy groups takes on the order of
-- 4.3e9 / (600 * N) minutes. The cost of the global bucket: a flood can make previews return
-- "too many requests" for everyone for up to a minute. Signed-in users are unaffected, because
-- the app keeps using group_by_invite_code() (per-user limit, migration 002) for them.

------------------------------------------------------------------------------------------------
-- Fixed-window counters. RLS on with no policies: only the SECURITY DEFINER function touches it.
------------------------------------------------------------------------------------------------

create table if not exists public.invite_preview_buckets (
  bucket_key   text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket_key, window_start)
);
create index if not exists invite_preview_buckets_window_idx
  on public.invite_preview_buckets (window_start);
alter table public.invite_preview_buckets enable row level security;
revoke all on table public.invite_preview_buckets from public, anon, authenticated;

------------------------------------------------------------------------------------------------
-- Bumps a bucket for the current window and returns the new count (atomic upsert).
------------------------------------------------------------------------------------------------

create or replace function public.bump_invite_preview_bucket(p_key text, p_window_seconds integer)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  win timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into public.invite_preview_buckets as b (bucket_key, window_start, count)
  values (p_key, win, 1)
  on conflict (bucket_key, window_start) do update set count = b.count + 1
  returning b.count into n;
  return n;
end;
$$;

revoke all on function public.bump_invite_preview_bucket(text, integer) from public, anon, authenticated;

------------------------------------------------------------------------------------------------
-- The preview itself
------------------------------------------------------------------------------------------------

drop function if exists public.public_invite_preview(text);
drop function if exists public.public_invite_preview(text, text);
create function public.public_invite_preview(code text, client_key text default null)
returns table (id uuid, name text, owner_teaser jsonb)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c text := lower(btrim(coalesce(code, '')));
  -- Anything that is not a SHA-256 hex digest shares one tight bucket
  k text := case when client_key ~ '^[a-f0-9]{64}$' then 'key:' || client_key else 'key:none' end;
  -- Separate variable: a CASE inside an IF condition ends the condition at its first THEN
  key_limit integer := case when client_key ~ '^[a-f0-9]{64}$' then 30 else 10 end;
begin
  -- Same format check as group_by_invite_code (8 hex legacy codes, 10-char codes since 002).
  -- Malformed input returns nothing and costs no rate-limit budget.
  if c !~ '^[a-z0-9]{8,10}$' then
    return;
  end if;

  -- Old windows are useless after an hour; the window index keeps this cheap
  delete from public.invite_preview_buckets b where b.window_start < now() - interval '1 hour';

  if public.bump_invite_preview_bucket('global', 60) > 600 then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;
  if public.bump_invite_preview_bucket(k, 600) > key_limit then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;

  return query
    select g.id,
           g.name,
           case when g.share_teaser then g.owner_teaser else null end
    from public.groups g
    where g.invite_code = c
    limit 1;
end;
$$;

revoke all on function public.public_invite_preview(text, text) from public;
grant execute on function public.public_invite_preview(text, text) to anon, authenticated;
