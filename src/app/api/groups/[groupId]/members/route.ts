import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { INVITE_CODE_RE } from "@/lib/supabase/groups";
import { WrappedDataSchema, clientIp, readJson } from "../../_lib/wrapped";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const JoinGroupSchema = z.object({
  nickname: z.string().trim().min(1).max(30),
  // Stripped to a summary server-side (no allBingeSessions, no per-binge title lists)
  wrappedData: WrappedDataSchema,
  // Required unless the caller owns the group; checked inside the join_group RPC
  inviteCode: z
    .string()
    .trim()
    .toLowerCase()
    .regex(INVITE_CODE_RE)
    .optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  if (!UUID_RE.test(groupId)) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const supabase = await createClient();

  // Rate limit: 5 joins per IP per minute
  if (!(await rateLimit(supabase, `join:${clientIp(request)}`, 5, 60_000)).success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Joining needs an account so each person holds one spot per group
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to join this group" }, { status: 401 });
  }
  if (!(await rateLimit(supabase, `join-user:${user.id}`, 5, 60_000)).success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const read = await readJson(request);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: read.status });

  const parsed = JoinGroupSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  // join_group (migration 002) checks the invite code (or ownership), the one-spot-per-user
  // unique index, and payload size, then inserts with the caller's auth.uid().
  const { data, error } = await supabase.rpc("join_group", {
    p_group_id: groupId,
    p_invite_code: parsed.data.inviteCode ?? null,
    p_nickname: parsed.data.nickname,
    p_wrapped_data: parsed.data.wrappedData,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "You're already in this group" }, { status: 409 });
    }
    if (error.code === "PT404" || error.message?.includes("group_not_found")) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    if (error.code === "PT422") {
      return NextResponse.json({ error: "Invalid nickname or stats" }, { status: 422 });
    }
    if (error.code === "PT429") {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    return NextResponse.json({ error: "Couldn't join the group" }, { status: 500 });
  }

  const member = Array.isArray(data) ? data[0] : data;
  if (!member) {
    return NextResponse.json({ error: "Couldn't join the group" }, { status: 500 });
  }
  return NextResponse.json(member, { status: 201 });
}
