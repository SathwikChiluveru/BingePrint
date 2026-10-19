"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WrappedStats } from "@/types";
import { isValidInviteCode, normalizeInviteCode } from "@/lib/supabase/groups";

// Invites older than this are ignored, so a stale link doesn't hijack future reels
export const PENDING_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Invite the user arrived through, kept so the wrapped ending can send them back to that group
export interface PendingInvite {
  code: string;
  groupName?: string;
  groupId?: string; // known once the code was looked up, so links can skip the lookup step
  savedAt?: number; // epoch ms; missing on invites saved before expiry existed
}

// The group this user most recently created or joined, used to attach an invite to the share card
export interface MyGroup {
  id: string;
  inviteCode: string;
  name: string;
  ownedByMe?: boolean; // true when this user created the group; missing on groups saved before it existed
  // The reel (sessionId) this group was created or joined from. Filled in by setMyGroup from the
  // current reel when the caller leaves it out; missing on groups saved before it existed.
  sessionId?: string;
}

interface AutoplayedStore {
  wrappedStats: WrappedStats | null;
  sessionId: string | null;
  pendingInvite: PendingInvite | null;
  myGroup: MyGroup | null;
  setWrapped: (stats: WrappedStats, sessionId: string) => void;
  clearWrapped: () => void;
  setPendingInvite: (invite: PendingInvite | null) => void;
  setMyGroup: (group: MyGroup | null) => void;
}

export function isPendingInviteFresh(invite: PendingInvite | null, now = Date.now()): invite is PendingInvite {
  if (!invite) return false;
  // localStorage is user-editable: a malformed code is treated as no invite
  if (!isValidInviteCode(invite.code)) return false;
  if (invite.savedAt === undefined) return false;
  return now - invite.savedAt < PENDING_INVITE_TTL_MS;
}

/**
 * True when myGroup was saved from a different reel than `sessionId`. Unknown origin is not stale.
 *
 * Stale does NOT mean gone: the user is still in that group, the group just sees an older reel.
 * Keep the group (its invite code still works) and offer "Update my stats in {group}", linking to
 * `/groups/{id}?update=1`, which refreshes their spot and re-stamps myGroup with the current reel.
 * In components prefer the reactive `useMyGroupNeedsUpdate()`; outside React, `myGroupNeedsUpdate()`.
 */
export function isMyGroupStale(group: MyGroup | null, sessionId: string | null | undefined): boolean {
  return !!group && !!group.sessionId && !!sessionId && group.sessionId !== sessionId;
}

const STORAGE_KEY = "autoplayed-session";
// Saved under the app's old name; copied once so existing reels survive the rename
const LEGACY_STORAGE_KEY = "binge-print-session";

if (typeof window !== "undefined") {
  try {
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null && window.localStorage.getItem(STORAGE_KEY) === null) {
      window.localStorage.setItem(STORAGE_KEY, legacy);
    }
    if (legacy !== null) window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage blocked (private mode); nothing to migrate
  }
}

export const useAutoplayedStore = create<AutoplayedStore>()(
  persist(
    (set) => ({
      wrappedStats: null,
      sessionId: null,
      pendingInvite: null,
      myGroup: null,
      setWrapped: (stats, sessionId) => set({ wrappedStats: stats, sessionId }),
      clearWrapped: () => set({ wrappedStats: null, sessionId: null }),
      setPendingInvite: (invite) =>
        set({
          pendingInvite:
            invite && isValidInviteCode(invite.code)
              ? { ...invite, savedAt: invite.savedAt ?? Date.now() }
              : null,
        }),
      setMyGroup: (myGroup) =>
        set((s) => ({
          myGroup: myGroup ? { ...myGroup, sessionId: myGroup.sessionId ?? s.sessionId ?? undefined } : null,
        })),
    }),
    {
      name: STORAGE_KEY,
    }
  )
);

/**
 * True when the stored group sees a different reel than `sessionId` (defaults to the current
 * reel), so the user should update their stats there. Reads the store once; not reactive.
 */
export function myGroupNeedsUpdate(sessionId?: string | null): boolean {
  const { myGroup, sessionId: current } = useAutoplayedStore.getState();
  return isMyGroupStale(myGroup, sessionId === undefined ? current : sessionId);
}

/** Reactive myGroupNeedsUpdate() for components. */
export function useMyGroupNeedsUpdate(sessionId?: string | null): boolean {
  return useAutoplayedStore((s) => isMyGroupStale(s.myGroup, sessionId === undefined ? s.sessionId : sessionId));
}

/** `/groups/{id}?update=1`: opens the group and refreshes this member's stats from the current reel. */
export function updateMyStatsHref(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}?update=1`;
}

/**
 * @deprecated A new reel no longer clears the stored group: the user is still in it, and dropping
 * it made people start duplicate groups. Kept as a no-op (always false) so existing callers
 * compile; use myGroupNeedsUpdate() and link "Update my stats in {group}" to updateMyStatsHref().
 */
export function clearMyGroupIfStale(sessionId: string | null | undefined): boolean {
  void sessionId;
  return false;
}

/**
 * Restore the invite from a `?join=CODE` URL param (another browser, or an upload link that
 * carried it). Validates and normalizes the code; anything malformed is ignored. A fresh saved
 * invite for the same code keeps its group name and id. Returns the adopted code, or null.
 */
export function adoptJoinParam(raw: string | null | undefined): string | null {
  const code = normalizeInviteCode(raw);
  if (!isValidInviteCode(code)) return null;
  const { pendingInvite, setPendingInvite } = useAutoplayedStore.getState();
  if (isPendingInviteFresh(pendingInvite) && pendingInvite.code === code) return code;
  setPendingInvite({ code });
  return code;
}
