import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { WrappedDataSchema, clientIp, readJson } from "../../../_lib/wrapped";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UpdateSchema = z.object({
  // Stripped to a summary server-side, same as joining
  wrappedData: WrappedDataSchema,
});

/**
 * PUT /api/groups/[groupId]/members/me: replace the caller's own wrapped_data in this group.
 *
 * Preferred path: a plain UPDATE of the caller's row, allowed by the "self update members" policy
 * (migration 004, column grant limited to wrapped_data and nickname).
 * Until 004 is applied, RLS silently blocks the UPDATE (0 rows). The fallback then uses only the
 * policies from 002: delete own row ("self delete members"), re-insert through join_group() with
 * the group's invite code (readable to members). If the re-insert fails, the old row is put back
 * the same way, so a failed update never costs the member their spot.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  if (!UUID_RE.test(groupId)) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const supabase = await createClient();
  if (!(await rateLimit(supabase, `update-ip:${clientIp(request)}`, 10, 60_000)).success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to update your stats" }, { status: 401 });
  }
  if (!(await rateLimit(supabase, `update-user:${user.id}`, 5, 60_000)).success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const read = await readJson(request);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: read.status });

  const parsed = UpdateSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const wrappedData = parsed.data.wrappedData;

  // The caller's current row (RLS "group read members" lets a member read it)
  const { data: current, error: readError } = await supabase
    .from("members")
    .select("*")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: "Couldn't update your stats" }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "You're not in this group" }, { status: 404 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("members")
    .update({ wrapped_data: wrappedData })
    .eq("id", current.id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();
  if (updated) return NextResponse.json(updated);
  // 42501 = permission denied (column grant); null data without error = RLS filtered the row
  if (updateError && updateError.code !== "42501") {
    return NextResponse.json({ error: "Couldn't update your stats" }, { status: 500 });
  }

  // Fallback without migration 004: delete own row, then rejoin with the new stats
  const { data: group } = await supabase.from("groups").select("invite_code").eq("id", groupId).maybeSingle();
  if (!group?.invite_code) {
    return NextResponse.json({ error: "Couldn't update your stats" }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from("members")
    .delete()
    .eq("id", current.id)
    .eq("user_id", user.id);
  if (deleteError) {
    return NextResponse.json({ error: "Couldn't update your stats" }, { status: 500 });
  }

  const rejoin = (data: unknown) =>
    supabase.rpc("join_group", {
      p_group_id: groupId,
      p_invite_code: group.invite_code,
      p_nickname: current.nickname,
      p_wrapped_data: data,
    });

  const { data: joined, error: joinError } = await rejoin(wrappedData);
  const member = Array.isArray(joined) ? joined[0] : joined;
  if (!joinError && member) return NextResponse.json(member);

  // Put the old row back so the member keeps their spot
  await rejoin(current.wrapped_data);
  return NextResponse.json({ error: "Couldn't update your stats" }, { status: 500 });
}
