-- 004: let a member refresh their own stats in place.
--
-- Before this, members had no UPDATE policy, so PUT /api/groups/[groupId]/members/me fell back to
-- delete + rejoin (two statements, new row id). This adds a narrow in-place path:
--   * Column grant: authenticated users may update only wrapped_data and nickname. group_id,
--     user_id, id and created_at stay unwritable, so a row can't be moved to another group or user.
--   * Policy: only your own row (auth.uid() = user_id), before and after the update.
--   * The existing size/length constraints from 002 still apply.
-- Safe to run more than once.

revoke update on public.members from authenticated, anon;
grant update (wrapped_data, nickname) on public.members to authenticated;

drop policy if exists "self update members" on public.members;
create policy "self update members"
  on public.members for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
