// Invite-code and teaser helpers shared by the /groups pages and the /api/groups routes.

/**
 * Invite codes are lowercase letters and digits: 8 hex chars for groups made before migration 002,
 * 10 chars from gen_invite_code() after it. Anything else is rejected before it reaches the DB.
 */
export const INVITE_CODE_RE = /^[a-z0-9]{8,10}$/;
export const INVITE_CODE_MAX_LENGTH = 10;

/** Trims, lowercases and drops spaces/dashes people add when retyping a code. */
export function normalizeInviteCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "");
}

export function isValidInviteCode(code: string): boolean {
  return INVITE_CODE_RE.test(code);
}

/**
 * Codes are stored and compared lowercase but always shown UPPERCASE (matches the share card).
 * normalizeInviteCode() lowercases whatever people type back in.
 */
export function displayInviteCode(code: string): string {
  return code.toUpperCase();
}

/**
 * Example code for input placeholders: 10 chars from gen_invite_code()'s alphabet (migration 002),
 * avoiding the look-alikes i/l/o/0/1 so the hint never shows a character people misread.
 */
export const INVITE_CODE_PLACEHOLDER = "K7MQ4XHR2P";

/** The owner's opt-in hook on the invite page. Built server-side from their summarised stats. */
export interface OwnerTeaser {
  personality: string;
  statLabel: string;
  statValue: string;
}

/** What a non-member sees of a group: no members, no wrapped data. */
export interface GroupPreview {
  id: string;
  name: string;
  invite_code: string;
  owner_teaser: OwnerTeaser | null;
  preview: true;
}

export function isOwnerTeaser(value: unknown): value is OwnerTeaser {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.personality === "string" &&
    typeof v.statLabel === "string" &&
    typeof v.statValue === "string"
  );
}
