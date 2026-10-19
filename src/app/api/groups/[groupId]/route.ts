import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidInviteCode, normalizeInviteCode } from "@/lib/supabase/groups";
import { clientIp, clientKey } from "../_lib/wrapped";
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
