import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidInviteCode, normalizeInviteCode } from "@/lib/supabase/groups";
import { clientIp, clientKey } from "../_lib/wrapped";
import { lookupByInviteCode } from "../_lib/lookup";

const noStore = { "Cache-Control": "no-store" };

// GET /api/groups/lookup?code=XXXX → { id, name, invite_code, owner_teaser, preview: true }
// No sign-in needed: an invitee sees which group they're joining before any login. Rate limited
// here per IP, then in the database (migration 003: per hashed client key + a global ceiling;
// signed-in users go through group_by_invite_code's per-user limit instead).
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!(await rateLimit(supabase, `lookup:${clientIp(request)}`, 20, 60_000)).success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: noStore });
  }

  const code = normalizeInviteCode(request.nextUrl.searchParams.get("code"));
  if (!isValidInviteCode(code)) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 400, headers: noStore });
  }

  const { data: { user } } = await supabase.auth.getUser();

  const result = await lookupByInviteCode(supabase, code, { signedIn: !!user, clientKey: clientKey(request) });
  if (!result.ok) {
    const error =
      result.status === 404
        ? "Group not found"
        : result.status === 429
          ? "Too many requests"
          : result.status === 401
            ? "Sign in to open this invite"
            : "Lookup failed";
    return NextResponse.json({ error }, { status: result.status, headers: noStore });
  }
  return NextResponse.json(result.group, { headers: noStore });
}
