import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { WrappedDataSchema, buildOwnerTeaser, clientIp, readJson } from "./_lib/wrapped";

const CreateGroupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  // Optional: when the creator's stats come along, they are added as the first member in the same request
  nickname: z.string().trim().min(1).max(30).optional(),
  // Stripped to a summary server-side (no allBingeSessions, no per-binge title lists)
  wrapped_data: WrappedDataSchema.optional(),
  // Opt-in: show the owner's personality + one stat on the invite page. Needs wrapped_data.
  share_teaser: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 10 groups per user per 10 minutes; also guards against double-taps creating twin groups
  if (!rateLimit(`create:${user.id}`, 10, 600_000).success || !rateLimit(`create-ip:${clientIp(request)}`, 20, 600_000).success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const read = await readJson(request);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: read.status });

  const parsed = CreateGroupSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const wrapped = parsed.data.wrapped_data;
  const shareTeaser = !!parsed.data.share_teaser && !!wrapped;

  const { data: group, error } = await supabase
    .from("groups")
    .insert({
      name: parsed.data.name,
      owner_id: user.id,
      share_teaser: shareTeaser,
      owner_teaser: shareTeaser && wrapped ? buildOwnerTeaser(wrapped) : null,
    })
    .select()
    .single();

  if (error || !group) {
    return NextResponse.json({ error: "Couldn't create the group" }, { status: 500 });
  }

  if (!wrapped) {
    return NextResponse.json({ ...group, members: [] }, { status: 201 });
  }

  // RLS "owner self insert members" allows the owner to add themselves with their own client
  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({
      group_id: group.id,
      user_id: user.id,
      nickname: parsed.data.nickname ?? "Me",
      wrapped_data: wrapped,
    })
    .select()
    .single();

  if (memberError || !member) {
    // "Create and add me" is one step: never leave an empty group behind or report half-success.
    await supabase.from("groups").delete().eq("id", group.id);
    return NextResponse.json({ error: "Couldn't add your stats to the new group" }, { status: 500 });
  }

  return NextResponse.json({ ...group, members: [member] }, { status: 201 });
}
