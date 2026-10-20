import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { GROUP_NAME_MAX_LENGTH, isValidInviteCode, normalizeInviteCode } from "@/lib/supabase/groups";
import { clientIp, clientKey, readJson } from "../_lib/wrapped";
import { lookupByInviteCode } from "../_lib/lookup";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const noStore = { "Cache-Control": "no-store" };

/**
 * Members and the owner get the group with every member (RLS, migration 002).
 * Anyone else, signed in or not, gets a preview (id, name, opt-in teaser) only when they pass the
 * group's invite code as ?code=. Signed-in callers are checked by group_by_invite_code, signed-out
 * ones by public_invite_preview (migration 003). Signed out without a code: 401. Otherwise 404.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  if (!UUID_RE.test(groupId)) {
    return NextResponse.json({ error: "Group not found" }, { status: 404, headers: noStore });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const code = normalizeInviteCode(request.nextUrl.searchParams.get("code"));
  const hasCode = isValidInviteCode(code);

  if (user) {
    const { data, error } = await supabase
      .from("groups")
      .select("*, members(*)")
      .eq("id", groupId)
      .maybeSingle();
    if (data) return NextResponse.json(data, { headers: noStore });
    // A failed query is not "gone": callers treat 404 as "forget this group", 5xx as "unconfirmed"
    if (error) {
      return NextResponse.json({ error: "Couldn't load the group" }, { status: 500, headers: noStore });
    }
  } else if (!hasCode) {
    return NextResponse.json({ error: "Sign in to see this group" }, { status: 401, headers: noStore });
  }

  if (!hasCode) {
    return NextResponse.json({ error: "Group not found" }, { status: 404, headers: noStore });
  }
  if (!(await rateLimit(supabase, `lookup:${clientIp(request)}`, 20, 60_000)).success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: noStore });
  }

  const result = await lookupByInviteCode(supabase, code, { signedIn: !!user, clientKey: clientKey(request) });
  if (!result.ok || result.group.id !== groupId) {
    const status = !result.ok && result.status !== 404 ? result.status : 404;
    const error =
      status === 429 ? "Too many requests" : status === 401 ? "Sign in to see this group" : "Group not found";
    return NextResponse.json({ error }, { status, headers: noStore });
  }
  return NextResponse.json({ ...result.group, members: [] }, { headers: noStore });
}

const RenameSchema = z.object({
  name: z.string().trim().min(1).max(GROUP_NAME_MAX_LENGTH),
});

/**
 * PATCH /api/groups/[groupId]  { name } → 200 { id, name }. Owner only.
 *
 * The UPDATE runs with the caller's client: migration 006 grants `update (name)` on groups and the
 * "owner rename groups" policy limits it to owner_id = auth.uid(). When it touches no row, a read
 * (RLS "member read groups") tells the cases apart: no row visible → 404, visible but someone
 * else owns it → 403, the caller owns it → 500 (migration 006 not applied yet).
 * 401 signed out, 422 invalid name, 429 rate limited.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  if (!UUID_RE.test(groupId)) {
    return NextResponse.json({ error: "Group not found" }, { status: 404, headers: noStore });
  }

  const supabase = await createClient();
  if (!(await rateLimit(supabase, `rename-ip:${clientIp(request)}`, 20, 60_000)).success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: noStore });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to rename this group" }, { status: 401, headers: noStore });
  }
  if (!(await rateLimit(supabase, `rename-user:${user.id}`, 10, 600_000)).success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: noStore });
  }

  const read = await readJson(request);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: read.status, headers: noStore });

  const parsed = RenameSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422, headers: noStore });
  }

  const { data: updated, error: updateError } = await supabase
    .from("groups")
    .update({ name: parsed.data.name })
    .eq("id", groupId)
    .eq("owner_id", user.id)
    .select("id, name")
    .maybeSingle();
  if (updated) return NextResponse.json({ id: updated.id, name: updated.name }, { headers: noStore });
  // 42501 = no column grant (migration 006 missing); null data without error = RLS filtered the row
  if (updateError && updateError.code !== "42501") {
    return NextResponse.json({ error: "Couldn't rename the group" }, { status: 500, headers: noStore });
  }

  const { data: group, error: readError } = await supabase
    .from("groups")
    .select("id, owner_id")
    .eq("id", groupId)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: "Couldn't rename the group" }, { status: 500, headers: noStore });
  }
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404, headers: noStore });
  }
  if (group.owner_id !== user.id) {
    return NextResponse.json({ error: "Only the person who started the group can rename it" }, { status: 403, headers: noStore });
  }
  return NextResponse.json({ error: "Couldn't rename the group" }, { status: 500, headers: noStore });
}
