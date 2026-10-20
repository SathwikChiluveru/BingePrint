-- 006_owner_rename_teaser_nickname.sql
--
-- Owner rename, and the inviter's name on the invite page. Run after 005_rate_limits.sql.
-- Safe to run more than once.
--
-- 1. Rename (PATCH /api/groups/[groupId]):
--    * Column grant: authenticated users may update groups.name and nothing else. owner_id,
--      invite_code, share_teaser, owner_teaser, id and created_at stay unwritable, so an owner
--      can't hand a group to someone else, mint their own invite code or write their own teaser text.
--    * Policy: only the owner's row (owner_id = auth.uid()), before and after the update.
--    * groups_name_length (002) still caps names at 1 to 60 characters.
--
-- 2. Nickname on the owner's teaser (P1-2, "Sam is The Binge Lord"):
--    The teaser stays server-built: POST /api/groups writes { personality, statLabel, statValue,
--    nickname } at create time. After that, the owner's nickname lives on their members row, which
--    they can edit (004 grants update (wrapped_data, nickname)). A trigger copies it into
--    groups.owner_teaser whenever the owner's row is inserted or its nickname changes, so the
--    owner never needs write access to owner_teaser. The placeholder nickname "Me" (what the create
--    route stores when the client sends none) is never shown: the key is removed instead, and the
--    invite page falls back to "Your friend is".
--    Groups without a teaser (share_teaser off, or owner_teaser null) are left alone: the trigger
--    only edits an existing teaser, it never creates one.
--
-- 3. Members editing their nickname and leaving need nothing new:
--    * "self update members" (004) + grant update (wrapped_data, nickname) covers nickname edits.
--    * "self delete members" (001/002) covers leaving (DELETE /api/groups/[groupId]/members/me).
--      An owner who leaves keeps the group: "member read groups" (002) lets owner_id read it, and
--      the trigger below does not touch the teaser on delete (it keeps the last nickname).
--
-- Not changed: group_by_invite_code and public_invite_preview already return owner_teaser as jsonb,
-- so the nickname reaches the invite page without touching either function. The 1024-byte
-- groups_owner_teaser_size check (002) has room: nicknames are capped at 30 characters.

------------------------------------------------------------------------------------------------
-- 1. Owner may rename (column-level grant + owner-only policy)
------------------------------------------------------------------------------------------------

revoke update on public.groups from authenticated, anon;
grant update (name) on public.groups to authenticated;

drop policy if exists "owner rename groups" on public.groups;
create policy "owner rename groups"
  on public.groups for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

------------------------------------------------------------------------------------------------
-- 2. Keep owner_teaser.nickname in step with the owner's members row
------------------------------------------------------------------------------------------------

-- The nickname to show, or null for the "Me" placeholder / blanks
create or replace function public.teaser_nickname(p_nickname text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_nickname is null then null
    when char_length(btrim(p_nickname)) not between 1 and 30 then null
    when lower(btrim(p_nickname)) = 'me' then null
    else btrim(p_nickname)
  end;
$$;

-- SECURITY DEFINER: the owner has no grant on owner_teaser; this writes only the nickname key,
-- taken from the owner's own row, never from request text.
create or replace function public.sync_owner_teaser_nickname()
returns trigger
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  shown text := public.teaser_nickname(new.nickname);
begin
  update public.groups g
     set owner_teaser = case
                          when shown is null then g.owner_teaser - 'nickname'
                          else g.owner_teaser || jsonb_build_object('nickname', shown)
                        end
   where g.id = new.group_id
     and g.owner_id = new.user_id
     and g.owner_teaser is not null
     and jsonb_typeof(g.owner_teaser) = 'object'
     and (g.owner_teaser ->> 'nickname') is distinct from shown;
  return null; -- AFTER trigger: return value ignored
end;
$$;

revoke all on function public.sync_owner_teaser_nickname() from public, anon, authenticated;

drop trigger if exists members_sync_owner_teaser_nickname on public.members;
create trigger members_sync_owner_teaser_nickname
  after insert or update of nickname on public.members
  for each row
  when (new.user_id is not null)
  execute function public.sync_owner_teaser_nickname();

------------------------------------------------------------------------------------------------
-- 3. Backfill: existing teasers pick up the owner's current nickname (or lose a stale one)
------------------------------------------------------------------------------------------------

update public.groups g
   set owner_teaser = case
                        when public.teaser_nickname(m.nickname) is null then g.owner_teaser - 'nickname'
                        else g.owner_teaser || jsonb_build_object('nickname', public.teaser_nickname(m.nickname))
                      end
  from public.members m
 where m.group_id = g.id
   and m.user_id = g.owner_id
   and g.owner_teaser is not null
   and jsonb_typeof(g.owner_teaser) = 'object'
   and (g.owner_teaser ->> 'nickname') is distinct from public.teaser_nickname(m.nickname);
