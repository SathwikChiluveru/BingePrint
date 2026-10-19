-- 005_rate_limits.sql
--
-- Durable rate limiting for the API routes. Run after 004_self_update_members.sql.
-- Safe to run more than once.
--
-- Why: src/lib/rate-limit.ts used an in-memory Map. On serverless hosting every instance has its
-- own Map and instances come and go, so a limit of "5 per minute" really meant "5 per minute per
-- warm instance". This moves the counters into Postgres so every instance shares them.
--
-- Adds:
--   * public.rate_limit_buckets: fixed-window counters, one row per (key, window).
--   * public.rate_limit_hit(p_key, p_limit, p_window_seconds) returns boolean: bumps the caller's
--     bucket for the current window and returns true when the request is allowed (count <= limit).
--
-- Keys: the Next.js server builds them and hashes them before calling, e.g.
-- sha256(salt || ':' || 'join:' || client_ip). The database never sees a raw IP or user id, only
-- an opaque 64-char hex digest. The salt (INVITE_PREVIEW_SALT or RATE_LIMIT_SALT) stops anyone
-- from reversing a digest by hashing the whole IPv4 space.
--
-- Tradeoff (same shape as 003): the anon key is public, so anyone can call rate_limit_hit()
-- directly through PostgREST. What they can do with it:
--   * Burn a bucket on purpose. They would have to know the salt to compute the digest of
--     someone else's key, so in practice they can only fill buckets nobody uses.
--   * Insert rows with junk keys. Each call adds at most one row per window; keys are capped at
--     128 chars, the limit and window are clamped, and old windows are deleted on every call, so
--     the table stays bounded by (calls per hour), the same as the API traffic it protects.
--   * Learn nothing: the function returns only true/false for the key they passed in.
-- Granting execute to anon is needed because signed-out routes (invite lookup) are rate limited
-- too, and the API calls this with the visitor's own (anon) Supabase client. The alternative, a
-- service-role key on the server, would put a key that bypasses RLS into the app environment;
-- this keeps the app on the anon key only.
--
-- The API falls back to its in-memory limiter when this function is missing (before this file is
-- applied, PostgREST answers PGRST202) or errors, so applying it is not a breaking change.

------------------------------------------------------------------------------------------------
-- Fixed-window counters. RLS on with no policies: only the SECURITY DEFINER function touches it.
------------------------------------------------------------------------------------------------

create table if not exists public.rate_limit_buckets (
  bucket_key   text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket_key, window_start)
);
-- Cleanup deletes by age; this keeps that cheap
create index if not exists rate_limit_buckets_window_idx
  on public.rate_limit_buckets (window_start);
alter table public.rate_limit_buckets enable row level security;
revoke all on table public.rate_limit_buckets from public, anon, authenticated;

------------------------------------------------------------------------------------------------
-- rate_limit_hit: one atomic upsert per call. Returns true when the request is allowed.
------------------------------------------------------------------------------------------------

create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  -- Clamp inputs so a direct caller can't create huge windows or absurd limits.
  -- Separate variables: a CASE inside an IF condition ends the condition at its first THEN.
  win_seconds integer := least(greatest(coalesce(p_window_seconds, 60), 1), 86400);
  max_count   integer := least(greatest(coalesce(p_limit, 1), 1), 100000);
  k           text    := left(coalesce(p_key, ''), 128);
  win         timestamptz;
  n           integer;
begin
  if k = '' then
    return false;
  end if;

  win := to_timestamp(floor(extract(epoch from now()) / win_seconds) * win_seconds);

  -- Old windows are useless once they are over a day old (the longest window allowed above)
  delete from public.rate_limit_buckets b where b.window_start < now() - interval '1 day';

  insert into public.rate_limit_buckets as b (bucket_key, window_start, count)
  values (k, win, 1)
  on conflict (bucket_key, window_start) do update set count = b.count + 1
  returning b.count into n;

  return n <= max_count;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public;
grant execute on function public.rate_limit_hit(text, integer, integer) to anon, authenticated;
