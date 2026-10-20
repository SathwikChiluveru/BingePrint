import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanOwnerTeaser, type GroupPreview } from "@/lib/supabase/groups";

export type LookupResult =
  | { ok: true; group: GroupPreview }
  | { ok: false; status: 401 | 404 | 429 | 500 };

type Row = { id: string; name: string; share_teaser?: boolean; owner_teaser: unknown };

interface LookupOptions {
  /** Signed-in callers use group_by_invite_code (per-user limit, migration 002). */
  signedIn: boolean;
  /** Hashed client key for public_invite_preview's per-client bucket (migration 003). */
  clientKey: string;
}

/**
 * Invite-code lookup. `code` must be pre-validated. Signed-out callers go through
 * public_invite_preview (migration 003), which returns only id, name and the opt-in teaser.
 */
export async function lookupByInviteCode(
  supabase: SupabaseClient,
  code: string,
  { signedIn, clientKey }: LookupOptions
): Promise<LookupResult> {
  const { data, error } = signedIn
    ? await supabase.rpc("group_by_invite_code", { code })
    : await supabase.rpc("public_invite_preview", { code, client_key: clientKey });
  if (error) {
    if (error.code === "PT429" || error.message?.includes("rate_limited")) return { ok: false, status: 429 };
    if (error.code === "PT401" || error.message?.includes("sign_in_required")) return { ok: false, status: 401 };
    // Migration 003 not applied yet: fall back to asking signed-out visitors to sign in
    if (!signedIn && error.code === "PGRST202") return { ok: false, status: 401 };
    return { ok: false, status: 500 };
  }
  const row = (Array.isArray(data) ? data[0] : data) as Row | undefined;
  if (!row) return { ok: false, status: 404 };
  // group_by_invite_code returns share_teaser; public_invite_preview already nulls the teaser when off
  const optedIn = row.share_teaser !== false;
  return {
    ok: true,
    group: {
      id: row.id,
      name: row.name,
      invite_code: code,
      owner_teaser: optedIn ? cleanOwnerTeaser(row.owner_teaser) : null,
      preview: true,
    },
  };
}
