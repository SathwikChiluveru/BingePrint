// Invite-code and teaser helpers shared by the /groups pages and the /api/groups routes.

import type { GroupMember } from "@/types";
import { leaveGroupErrorMessage, nicknameErrorMessage, renameGroupErrorMessage } from "@/lib/copy/invite";

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

/**
 * The owner's opt-in hook on the invite page. Built server-side from their summarised stats.
 * `nickname` is the owner's name in the group ("Sam is The Binge Lord"); missing on teasers made
 * before migration 006, or when the owner never picked a name. Kept in step with the owner's
 * members row by the trigger in migration 006.
 */
export interface OwnerTeaser {
  personality: string;
  statLabel: string;
  statValue: string;
  nickname?: string;
}

/** Longest nickname a member (and so a teaser) can carry. Matches members_nickname_length (002). */
export const NICKNAME_MAX_LENGTH = 30;
/** Longest group name. Matches groups_name_length (002). */
export const GROUP_NAME_MAX_LENGTH = 60;

/**
 * The nickname to show on a teaser, or null. "Me" is the create route's placeholder when the
 * client sends no name, so it never reads as "Me is The Binge Lord". Same rule as
 * public.teaser_nickname() in migration 006.
 */
export function teaserNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (name.length < 1 || name.length > NICKNAME_MAX_LENGTH) return null;
  if (name.toLowerCase() === "me") return null;
  return name;
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
    typeof v.statValue === "string" &&
    (v.nickname === undefined || v.nickname === null || typeof v.nickname === "string")
  );
}

/**
 * A stored teaser reduced to the fields the invite page may show. Drops anything else in the
 * jsonb and any nickname that fails teaserNickname(). Null when it isn't a teaser at all.
 */
export function cleanOwnerTeaser(value: unknown): OwnerTeaser | null {
  if (!isOwnerTeaser(value)) return null;
  const nickname = teaserNickname(value.nickname);
  return {
    // Teasers stored before the rename may still say "The Genre Surfer"
    personality: value.personality === "The Genre Surfer" ? "The Channel Surfer" : value.personality,
    statLabel: value.statLabel,
    statValue: value.statValue,
    ...(nickname ? { nickname } : {}),
  };
}

/** One row of GET /api/groups: a group the signed-in user owns or is a member of. */
export interface MyGroupSummary {
  id: string;
  name: string;
  invite_code: string;
  memberCount: number;
  /** This user created the group */
  ownedByMe: boolean;
  /** This user has a spot on the board (an owner can create a group without adding their reel) */
  isMember: boolean;
}

export type MyGroupsResult =
  | { ok: true; groups: MyGroupSummary[] }
  | { ok: false; reason: "signed-out" | "rate-limited" | "failed" };

export const MY_GROUPS_TIMEOUT_MS = 10_000;

/**
 * The signed-in user's groups, newest first (client side). Never throws: signed out is
 * `{ ok: false, reason: "signed-out" }`, and timeouts or network errors are "failed".
 */
export async function fetchMyGroups(
  { signal, timeoutMs = MY_GROUPS_TIMEOUT_MS }: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<MyGroupsResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch("/api/groups", { cache: "no-store", signal: controller.signal });
    if (res.status === 401) return { ok: false, reason: "signed-out" };
    if (res.status === 429) return { ok: false, reason: "rate-limited" };
    if (!res.ok) return { ok: false, reason: "failed" };
    const data = (await res.json().catch(() => null)) as { groups?: unknown } | null;
    if (!data || !Array.isArray(data.groups)) return { ok: false, reason: "failed" };
    return { ok: true, groups: data.groups as MyGroupSummary[] };
  } catch {
    return { ok: false, reason: "failed" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Result of the group-edit helpers below. `message` is owned copy, ready to show. */
export type GroupEditResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; status: number; message: string };

export const GROUP_EDIT_TIMEOUT_MS = 10_000;

/** Status 0 means the request never got an answer (offline, timeout, bad body). */
async function send<T>(
  url: string,
  init: RequestInit,
  message: (status: number) => string,
  read: (body: unknown) => T | null
): Promise<GroupEditResult<T & object>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROUP_EDIT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
    });
    if (!res.ok) return { ok: false, status: res.status, message: message(res.status) };
    const body = await res.json().catch(() => null);
    const value = read(body);
    if (!value) return { ok: false, status: 0, message: message(0) };
    return { ok: true, ...(value as T & object) };
  } catch {
    return { ok: false, status: 0, message: message(0) };
  } finally {
    clearTimeout(timer);
  }
}

const groupPath = (id: string) => `/api/groups/${encodeURIComponent(id)}`;

/** Owner renames their group (PATCH /api/groups/[id]). Never throws. On success, `name` is the stored name. */
export function renameGroup(id: string, name: string): Promise<GroupEditResult<{ name: string }>> {
  return send(
    groupPath(id),
    { method: "PATCH", body: JSON.stringify({ name: name.trim() }) },
    renameGroupErrorMessage,
    (body) => {
      const b = body as { name?: unknown } | null;
      return b && typeof b.name === "string" ? { name: b.name } : null;
    }
  );
}

/** Member changes their own nickname (PUT /api/groups/[id]/members/me). Never throws. */
export function updateNickname(id: string, nickname: string): Promise<GroupEditResult<{ member: GroupMember }>> {
  return send(
    `${groupPath(id)}/members/me`,
    { method: "PUT", body: JSON.stringify({ nickname: nickname.trim() }) },
    nicknameErrorMessage,
    (body) => {
      const b = body as { member?: unknown } | null;
      return b && b.member && typeof b.member === "object" ? { member: b.member as GroupMember } : null;
    }
  );
}

/**
 * Member leaves (DELETE /api/groups/[id]/members/me). Never throws. Owners can leave too; the
 * group stays theirs. Callers should clear the stored myGroup when it is this group.
 */
export function leaveGroup(id: string): Promise<GroupEditResult> {
  return send(`${groupPath(id)}/members/me`, { method: "DELETE" }, leaveGroupErrorMessage, (body) => {
    const b = body as { left?: unknown } | null;
    return b && b.left === true ? {} : null;
  });
}
