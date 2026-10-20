"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { forgetMyGroup, isPendingInviteFresh, useAutoplayedStore } from "@/lib/store";
import InviteActions from "@/components/groups/InviteActions";
import InviteFrame, { InAppInvite, NetflixFileSteps, useInAppBrowser } from "@/components/groups/InviteFrame";
import InviteCodeChip from "@/components/groups/InviteCodeChip";
import InlineEdit, { type SaveResult } from "@/components/groups/InlineEdit";
import LeaveGroup from "@/components/groups/LeaveGroup";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "@/components/groups/icons";
import { statsFingerprint, suggestNickname } from "@/components/groups/memberStats";
import { StandingsList } from "@/components/compare/StandingRow";
import { buildComparison, rankMembers } from "@/components/compare/compareModel";
import type { Group, GroupMember, WrappedStats } from "@/types";
import {
  GROUP_NAME_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  isValidInviteCode,
  normalizeInviteCode,
  renameGroup,
  teaserNickname,
  updateNickname,
  type GroupPreview,
  type OwnerTeaser,
} from "@/lib/supabase/groups";
import { toGroupSummary } from "@/lib/share/safety";
import {
  JOIN_ACTIONS,
  addReelToLabel,
  groupNameForButton,
  newSinceLastVisitLine,
  updateStatsLabel,
  uploadWithInviteHref,
} from "@/lib/copy/invite";

// Members get the full group; a non-member who came through an invite gets a preview (no members)
type LoadedGroup =
  | (Group & { preview?: false; owner_teaser?: OwnerTeaser | null })
  | (GroupPreview & { members: GroupMember[]; owner_id?: undefined });

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
  caretColor: "var(--color-red)",
};

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const PRIVACY_LINE = "Only your stats are shared with the group, never your file.";

// A hung group request never leaves "Loading group…" up longer than this
const LOAD_TIMEOUT_MS = 12_000;

type LoadError = "not-found" | "rate-limited" | "failed";

// Group page preview of the standings: the top three (plus the viewer); compare has everyone
const STANDINGS_PREVIEW = 3;

function joinErrorMessage(status: number) {
  if (status === 401) return "Your sign-in expired. Sign in again, then add your reel.";
  if (status === 409) return "You're already in this group. Refresh to see your spot.";
  if (status === 413) return "Your stats came out too big to send. Upload your file again.";
  if (status === 429) return "Too many join attempts from this network. Wait a minute, then try again.";
  if (status === 404) return "This group no longer exists. Ask your friend for a new invite.";
  if (status === 422) return "Pick a nickname between 1 and 30 characters, then try again.";
  if (status === 400) return "That request got garbled on the way. Reload the page and try again.";
  if (status >= 500) return "Couldn't add your reel. Try again in a moment.";
  return "Couldn't add your reel. Reload the page and try again.";
}

function updateErrorMessage(status: number) {
  if (status === 401) return "Your sign-in expired. Sign in again, then update your stats.";
  if (status === 404) return "You're not in this group anymore. Refresh the page.";
  if (status === 413 || status === 422) return "Your stats couldn't be read. Upload your file again.";
  if (status === 429) return "Too many updates. Wait a minute, then try again.";
  return "Couldn't update your stats. Your old stats are still there. Try again.";
}

// Member count this device saw on its last visit, per group. Local only: there are no join
// notifications, so this is how a returning member learns friends joined. Storage can be blocked
// (private mode, cleared data), so every access is wrapped and a miss just shows nothing.
const seenKey = (groupId: string) => `autoplayed:group-seen:${groupId}`;

function readSeenCount(groupId: string): number | null {
  try {
    const raw = window.localStorage.getItem(seenKey(groupId));
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function writeSeenCount(groupId: string, count: number) {
  try {
    window.localStorage.setItem(seenKey(groupId), String(count));
  } catch {
    // Storage unavailable: the line just won't appear next time
  }
}

type AuthUser = { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null };

async function loadUser(): Promise<AuthUser | null> {
  try {
    const {
      data: { user },
    } = await createClient().auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}

function CenteredMain({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--color-bg)" }}>
      {children}
    </main>
  );
}

function GroupDetail() {
  const params = useParams();
  const groupId = params.groupId as string;
  // ?code= from an invite link or the post-sign-in return; only a well-formed code is used
  const searchParams = useSearchParams();
  const rawCode = normalizeInviteCode(searchParams.get("code"));
  const codeParam = isValidInviteCode(rawCode) ? rawCode : null;
  // ?add=1 from compare: the owner who isn't on the board wants the join form open
  const addParam = searchParams.get("add") === "1";
  // ?update=1 from the reel ("Update my stats in {group}"): a member's spot is refreshed on arrival.
  // Read once: the param is dropped from the URL as soon as the update starts.
  const [updateRequested] = useState(() => searchParams.get("update") === "1");
  // Sign-in from here comes straight back with the same intent (?code, ?add, ?update)
  const currentSearch = searchParams.toString();

  const [group, setGroup] = useState<LoadedGroup | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Joined and still the only member: the invite takes over, with a short confirmation
  const [joinedAlone, setJoinedAlone] = useState(false);
  const [joining, setJoining] = useState(false);
  // null = untouched, so the name from the signed-in profile fills the field
  const [typedNickname, setTypedNickname] = useState<string | null>(null);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [error, setError] = useState("");
  // 409: already a member, so the fix is a reload of the group, offered as a button
  const [joinConflict, setJoinConflict] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{ ok: boolean; text: string } | null>(null);
  // Members who joined since this device last opened the group (0 = say nothing)
  const [joinedSinceVisit, setJoinedSinceVisit] = useState(0);
  const autoUpdateStarted = useRef(false);

  const wrappedStats = useAutoplayedStore((s) => s.wrappedStats);
  const pendingInvite = useAutoplayedStore((s) => s.pendingInvite);
  const setPendingInvite = useAutoplayedStore((s) => s.setPendingInvite);
  const setMyGroup = useAutoplayedStore((s) => s.setMyGroup);
  const myGroup = useAutoplayedStore((s) => s.myGroup);
  const sessionId = useAutoplayedStore((s) => s.sessionId);
  const router = useRouter();
  const inApp = useInAppBrowser();

  const nickname = typedNickname ?? suggestNickname(user);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
    // Non-members (signed in or not) can only see a group through its invite code (migrations 002/003).
    // The URL's ?code= wins; otherwise a fresh saved invite for this group. Expired invites are dropped.
    const { pendingInvite, setPendingInvite: clearInvite } = useAutoplayedStore.getState();
    const freshInvite = isPendingInviteFresh(pendingInvite) ? pendingInvite : null;
    if (pendingInvite && !freshInvite) clearInvite(null);
    const inviteCode =
      codeParam ??
      (freshInvite && (!freshInvite.groupId || freshInvite.groupId === groupId) ? freshInvite.code : null);
    const url = `/api/groups/${encodeURIComponent(groupId)}${
      inviteCode ? `?code=${encodeURIComponent(inviteCode)}` : ""
    }`;
    const groupRequest = fetch(url, { signal: controller.signal }).then(async (r) => ({
      status: r.status,
      data: await r.json().catch(() => ({ error: "Invalid response" })),
    }));
    Promise.all([groupRequest, loadUser()])
      .then(([{ status, data }, authUser]) => {
        if (cancelled) return;
        setUser(authUser);
        if (status === 401) {
          setNeedsSignIn(true);
          return;
        }
        if (status === 429) {
          setLoadError("rate-limited");
          return;
        }
        if (status >= 500) {
          setLoadError("failed");
          return;
        }
        if (data.error) {
          setLoadError("not-found");
          return;
        }
        setLoadError(null);
        setGroup(data);
        // Compare with the last visit before the effect below records this one. Only the member
        // view of a member has the real list (RLS hides it from non-members); the first visit sets
        // the baseline and says nothing.
        if (
          !data.preview &&
          Array.isArray(data.members) &&
          !!authUser &&
          data.members.some((m: GroupMember) => m.user_id === authUser.id)
        ) {
          const seen = readSeenCount(groupId);
          if (seen !== null && data.members.length > seen) setJoinedSinceVisit(data.members.length - seen);
        }
        // The preview's own CTA leads; a member-view non-member (an owner who never added their
        // reel) gets the form straight away when they came for it
        if (
          !data.preview &&
          (addParam || (freshInvite && (freshInvite.groupId === data.id || freshInvite.code === data.invite_code)))
        ) {
          setShowJoinForm(true);
        }
        runRequestedUpdate(data, authUser);
      })
      .catch(() => {
        // Offline, or the request ran past LOAD_TIMEOUT_MS
        if (!cancelled) setLoadError("failed");
      })
      .finally(() => {
        clearTimeout(timer);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
    // runRequestedUpdate is guarded by a ref and reads the store directly; reloading on its
    // identity would refetch the group every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, codeParam, addParam, attempt]);

  const members: GroupMember[] = useMemo(() => group?.members ?? [], [group]);
  const standings = useMemo(() => rankMembers(members, user?.id ?? null), [members, user]);
  // Two or more on the board: the page leads with the same head-to-head compare opens with
  const comparison = useMemo(
    () => (members.length >= 2 ? buildComparison(members, user?.id ?? null) : null),
    [members, user]
  );

  // Record what this device has now seen as a member, including the viewer's own join
  const seenAsMember = !!group && group.preview !== true && !!user && members.some((m) => m.user_id === user.id);
  useEffect(() => {
    if (seenAsMember) writeSeenCount(groupId, members.length);
  }, [groupId, seenAsMember, members.length]);

  function retryLoad() {
    setLoading(true);
    setLoadError(null);
    setError("");
    setJoinConflict(false);
    setAttempt((n) => n + 1);
  }

  // Owner rename: the header and the stored group shortcut pick up the new name
  async function saveGroupName(next: string): Promise<SaveResult> {
    const result = await renameGroup(groupId, next);
    if (!result.ok) return { ok: false, message: result.message };
    setGroup((prev) => (prev ? ({ ...prev, name: result.name } as LoadedGroup) : prev));
    if (myGroup?.id === groupId) setMyGroup({ ...myGroup, name: result.name });
    return { ok: true };
  }

  // A member's own nickname (the standings, compare and, for the owner, the invite teaser)
  async function saveNickname(next: string): Promise<SaveResult> {
    const result = await updateNickname(groupId, next);
    if (!result.ok) return { ok: false, message: result.message };
    const updated = result.member;
    setGroup((prev) =>
      prev
        ? ({
            ...prev,
            members: (prev.members ?? []).map((m) => (m.user_id === updated.user_id ? { ...m, ...updated } : m)),
          } as LoadedGroup)
        : prev
    );
    return { ok: true };
  }

  function handleLeft() {
    forgetMyGroup(groupId);
    router.push("/groups");
  }

  async function handleJoinGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!wrappedStats || !group) return;
    setJoining(true);
    setError("");
    setJoinConflict(false);

    let res: Response;
    try {
      res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), wrappedData: toGroupSummary(wrappedStats), inviteCode: group.invite_code }),
      });
    } catch {
      setJoining(false);
      setError("Couldn't reach Autoplayed. Check your connection and try again.");
      return;
    }

    if (!res.ok) {
      setJoining(false);
      setJoinConflict(res.status === 409);
      setError(joinErrorMessage(res.status));
      return;
    }

    const member: GroupMember | null = await res.json().catch(() => null);
    // Now a member, RLS lets us read the whole group; fall back to appending if the refetch fails
    const full = await fetch(`/api/groups/${encodeURIComponent(groupId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    setPendingInvite(null);
    // setMyGroup stamps the current reel's sessionId
    setMyGroup({
      id: group.id,
      inviteCode: group.invite_code,
      name: group.name,
      ownedByMe: !!user && user.id === group.owner_id,
    });
    const fullGroup = full && !full.error && Array.isArray(full.members) ? (full as LoadedGroup) : null;
    // Someone to compare against: go straight to the reveal
    if (fullGroup && (fullGroup.members ?? []).length >= 2) {
      router.push(`/groups/${encodeURIComponent(groupId)}/compare?joined=1`);
      return;
    }
    // Stays "Adding…" through the refetch so a second tap can't fire a duplicate join
    setJoining(false);
    setGroup((prev) => {
      if (fullGroup) return fullGroup;
      if (!prev) return prev;
      // Refetch failed: show at least this member, as a member view rather than the preview
      return { ...prev, preview: false, members: [...(prev.members ?? []), ...(member ? [member] : [])] } as LoadedGroup;
    });
    setShowJoinForm(false);
    setJoinedAlone(true);
  }

  function handleUpdateStats() {
    if (!group || !wrappedStats || updating) return;
    void updateStats(group, user, wrappedStats);
  }

  // Takes the group, user and stats as arguments so the ?update=1 flow can run it straight from
  // the load callback, before those reach state
  async function updateStats(group: LoadedGroup, user: AuthUser | null, wrappedStats: WrappedStats) {
    setUpdating(true);
    setUpdateStatus(null);
    let res: Response;
    try {
      res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/members/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wrappedData: toGroupSummary(wrappedStats) }),
      });
    } catch {
      setUpdating(false);
      setUpdateStatus({ ok: false, text: "Couldn't reach Autoplayed. Check your connection and try again." });
      return;
    }
    if (!res.ok) {
      setUpdating(false);
      setUpdateStatus({ ok: false, text: updateErrorMessage(res.status) });
      return;
    }
    const body: { member?: GroupMember } | null = await res.json().catch(() => null);
    const updated = body?.member ?? null;
    setUpdating(false);
    if (updated && user) {
      setGroup((prev) =>
        prev
          ? ({
              ...prev,
              members: [...(prev.members ?? []).filter((m) => m.user_id !== user.id), updated],
            } as LoadedGroup)
          : prev
      );
    }
    // This reel is now the one the group sees
    setMyGroup({
      id: group.id,
      inviteCode: group.invite_code,
      name: group.name,
      ownedByMe: !!user && user.id === group.owner_id,
    });
    setUpdateStatus({ ok: true, text: "Stats updated. The group sees your new reel." });
  }

  // ?update=1: called once the member view has loaded. Refreshes this member's spot from the reel
  // on this device, or (same numbers) just re-stamps myGroup; the "already matches" confirmation
  // is derived in render. Runs once, then the param leaves the URL so a reload or a shared link
  // never repeats it. Non-members, signed-out visitors and visitors without a reel get the normal page.
  function runRequestedUpdate(loaded: LoadedGroup, authUser: AuthUser | null) {
    const stats = useAutoplayedStore.getState().wrappedStats;
    if (!updateRequested || autoUpdateStarted.current || loaded.preview || !authUser || !stats) return;
    const mine = (loaded.members ?? []).find((m) => m.user_id === authUser.id);
    if (!mine) return;
    autoUpdateStarted.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("update");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    if (statsFingerprint(mine.wrapped_data) !== statsFingerprint(stats)) {
      void updateStats(loaded, authUser, stats);
      return;
    }
    setMyGroup({ id: loaded.id, inviteCode: loaded.invite_code, name: loaded.name, ownedByMe: authUser.id === loaded.owner_id });
  }

  if (loading) {
    return (
      <CenteredMain>
        <p role="status" style={{ color: "var(--color-text-secondary)" }}>
          Loading group…
        </p>
      </CenteredMain>
    );
  }

  if (needsSignIn) {
    return (
      <CenteredMain>
        <div className="w-full max-w-md flex flex-col gap-4 text-center">
          <h1 className="text-headline font-bold" style={{ color: "var(--color-text)" }}>
            Sign in to see this group
          </h1>
          <p style={{ color: "var(--color-text-secondary)" }}>
            Groups are private to the people in them. Sign in here and you&apos;ll come straight back.
          </p>
          <Link
            href={`/auth/login?next=${encodeURIComponent(`/groups/${groupId}${currentSearch ? `?${currentSearch}` : ""}`)}`}
            className="btn-primary py-3"
          >
            Sign in
            <ArrowRightIcon />
          </Link>
        </div>
      </CenteredMain>
    );
  }

  if (loadError === "rate-limited" || loadError === "failed") {
    const limited = loadError === "rate-limited";
    return (
      <CenteredMain>
        <div role="alert" className="w-full max-w-md flex flex-col gap-4 text-center">
          <h1 className="text-headline font-bold" style={{ color: "var(--color-text)" }}>
            {limited ? "Too many tries, wait a minute" : "The group didn't load"}
          </h1>
          <p style={{ color: "var(--color-text-secondary)" }}>
            {limited
              ? "Invite links are rate limited to stop code guessing. Your invite is fine. Wait a minute, then try again."
              : "Autoplayed took too long to answer, or you're offline. Check your connection and try again."}
          </p>
          <button type="button" onClick={retryLoad} className="btn-primary py-3">
            Try again
          </button>
        </div>
      </CenteredMain>
    );
  }

  if (loadError === "not-found" || !group) {
    return (
      <CenteredMain>
        <div className="w-full max-w-md flex flex-col gap-4 text-center">
          <h1 className="text-headline font-bold" style={{ color: "var(--color-text)" }}>
            We couldn&apos;t find that group
          </h1>
          <p style={{ color: "var(--color-text-secondary)" }}>
            The link may be wrong, the group was deleted, or you&apos;re not in it yet. Ask your friend for their
            invite code.
          </p>
          <Link href="/groups?mode=join" className="btn-primary py-3">
            Enter an invite code
          </Link>
        </div>
      </CenteredMain>
    );
  }

  const isPreview = group.preview === true;
  const teaser = group.owner_teaser ?? null;
  const isOwner = !!user && user.id === group.owner_id;
  const myMember = user ? members.find((m) => m.user_id === user.id) ?? null : null;
  const isMember = !!myMember;
  const isFresh = !isPreview && members.length <= 1;
  // The local reel differs from what the group sees: offer to update it in place
  const statsOutdated =
    !!myMember && !!wrappedStats && statsFingerprint(myMember.wrapped_data) !== statsFingerprint(wrappedStats);
  // Arrived via ?update=1 as a member with a reel: the update's progress and result lead the page
  const autoUpdate = updateRequested && isMember && !!wrappedStats;
  // One red action per screen: the join form when open; for an owner off the board, adding their
  // reel; else Compare once there's a pair; else sharing the invite
  const primary: "join" | "add" | "compare" | "share" =
    showJoinForm && !isMember
      ? "join"
      : isOwner && !isMember
        ? "add"
        : members.length >= 2
          ? "compare"
          : "share";
  // Back to this group after sign-in, carrying the code so a non-member still lands on the preview
  const returnPath = isPreview
    ? `/groups/${groupId}?code=${encodeURIComponent(group.invite_code)}`
    : `/groups/${groupId}`;
  const signInHref = `/auth/login?next=${encodeURIComponent(returnPath)}`;
  // Signing in to add a reel: &add=1 opens the form as soon as they're back
  const signInToAddHref = `/auth/login?next=${encodeURIComponent(
    `${returnPath}${returnPath.includes("?") ? "&" : "?"}add=1`
  )}`;
  // Invitee who arrived with this group's code (URL or a fresh saved invite), signed in, reel on
  // hand: skip the pitch and go straight to adding the reel
  const invite = isPendingInviteFresh(pendingInvite) ? pendingInvite : null;
  const inviteMatches =
    !!codeParam || addParam || (!!invite && (invite.groupId === group.id || invite.code === group.invite_code));
  const directAdd = isPreview && !!wrappedStats && !!user && inviteMatches;
  const buttonGroupName = groupNameForButton(group.name);
  // Back to the reel on this device when there is one; signed in without one, to "Your groups"
  // on /groups; everyone else home
  const reelHref = sessionId ? `/wrapped/${encodeURIComponent(sessionId)}` : null;
  const hasReel = !!reelHref && !!wrappedStats;
  const backHref = hasReel && reelHref ? reelHref : user ? "/groups" : "/";
  const backLabel = hasReel ? "My reel" : user ? "Your groups" : "Home";
  const rememberInvite = () =>
    setPendingInvite({ code: group.invite_code, groupName: group.name, groupId: group.id });

  const errorBox = error && (
    <div
      role="alert"
      className="text-sm p-3 rounded-xl"
      style={{
        background: "var(--color-red-subtle)",
        border: "1px solid var(--color-red-border)",
        color: "var(--color-red-text)",
      }}
    >
      {error}
      {joinConflict && (
        <>
          {" "}
          <button type="button" onClick={retryLoad} className="inline-flex min-h-[44px] items-center underline underline-offset-2 font-semibold">
            Refresh
          </button>
        </>
      )}
      {error.startsWith("Your sign-in expired") && (
        <>
          {" "}
          <Link href={signInHref} className="underline underline-offset-2 font-semibold">
            Sign in
          </Link>
        </>
      )}
    </div>
  );

  const privacyLine = (
    <p className="text-sm" style={{ color: "var(--color-muted)" }}>
      {PRIVACY_LINE}
    </p>
  );

  const cancelButton = (
    <button
      type="button"
      onClick={() => setShowJoinForm(false)}
      className="min-h-[44px] text-sm"
      style={{ color: "var(--color-muted)" }}
    >
      Cancel
    </button>
  );

  // Nickname form for a signed-in visitor with a reel (an invitee, or an owner off the board).
  // The direct-add view has no Cancel: the form is the whole page there.
  const joinForm = (
    <motion.form
      onSubmit={handleJoinGroup}
      className="flex flex-col gap-4 text-left"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
          Your name in {groupNameForButton(group.name, "the group")}
        </span>
        <input
          type="text"
          required
          maxLength={30}
          autoComplete="nickname"
          placeholder="What your friends call you"
          value={nickname}
          onChange={(e) => setTypedNickname(e.target.value)}
          className="w-full min-h-[44px] px-4 py-3 rounded-xl text-base"
          style={inputStyle}
        />
      </label>
      {privacyLine}
      {errorBox}
      <button type="submit" disabled={joining || !nickname.trim()} className="btn-primary py-3">
        {joining ? "Adding…" : JOIN_ACTIONS.addReel}
      </button>
      {!directAdd && cancelButton}
    </motion.form>
  );

  // ---------- Invite landing: the preview a non-member sees through an invite ----------
  if (isPreview) {
    let action: React.ReactNode;
    if (!wrappedStats) {
      action = inApp ? (
        <>
          <InAppInvite code={group.invite_code} />
          <Link
            href={uploadWithInviteHref(group.invite_code)}
            onClick={rememberInvite}
            className="self-center inline-flex items-center min-h-[44px] px-3 text-sm underline underline-offset-4"
            style={{ color: "var(--color-text-secondary)" }}
          >
            I already have my file
          </Link>
        </>
      ) : (
        <>
          <Link href={uploadWithInviteHref(group.invite_code)} onClick={rememberInvite} className="btn-primary py-3 text-lg">
            {JOIN_ACTIONS.makeReel}
            <ArrowRightIcon />
          </Link>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Your reel ends with a link back here.
          </p>
          <div className="mt-4">
            <NetflixFileSteps />
          </div>
        </>
      );
    } else if (!user) {
      action = (
        <>
          <Link href={signInToAddHref} onClick={rememberInvite} className="btn-primary py-3 text-lg">
            {JOIN_ACTIONS.signInToAdd}
            <ArrowRightIcon />
          </Link>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            You&apos;ll sign in once so each person holds one spot, then come straight back. {PRIVACY_LINE}
          </p>
        </>
      );
    } else if (showJoinForm) {
      action = joinForm;
    } else {
      action = (
        <>
          <button type="button" onClick={() => setShowJoinForm(true)} className="btn-primary py-3 text-lg">
            {JOIN_ACTIONS.addReel}
            <ArrowRightIcon />
          </button>
          {privacyLine}
        </>
      );
    }

    const backLink = (
      <div className="w-full max-w-xl mx-auto">
        <Link
          href={backHref}
          className="-ml-1 inline-flex items-center gap-2 min-h-[44px] pr-3 text-sm transition-colors hover:text-[var(--color-text)]"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <ArrowLeftIcon size={16} />
          {backLabel}
        </Link>
      </div>
    );

    // Already pitched, already has a reel, already signed in: no second pitch, just the form
    if (directAdd) {
      return (
        <main className="min-h-screen flex flex-col px-6 pt-3 pb-12" style={{ background: "var(--color-bg)" }}>
          {backLink}
          <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center py-10 gap-6">
            <div>
              <h1
                className="text-headline font-bold [overflow-wrap:anywhere]"
                style={{ color: "var(--color-text)", textWrap: "balance" }}
              >
                {addReelToLabel(group.name)}
              </h1>
              <p className="mt-2" style={{ color: "var(--color-text-secondary)" }}>
                {buttonGroupName === group.name.trim() ? (
                  "Your stats go on the board next to everyone else's."
                ) : (
                  <>
                    Your stats go on the board in{" "}
                    <span className="font-semibold [overflow-wrap:anywhere]" style={{ color: "var(--color-text)" }}>
                      {group.name}
                    </span>
                    .
                  </>
                )}
                {teaser && (
                  <>
                    {" "}
                    {teaserNickname(teaser.nickname) ?? "Your friend"} is {teaser.personality.replace(/^The\s+/, "the ")}.
                    Think you watch less?
                  </>
                )}
              </p>
            </div>
            {joinForm}
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen flex flex-col px-6 pt-3 pb-12" style={{ background: "var(--color-bg)" }}>
        {backLink}
        <div className="w-full max-w-xl mx-auto flex-1 flex flex-col justify-center py-10">
          <InviteFrame groupName={group.name} teaser={teaser}>
            {action}
          </InviteFrame>
        </div>
      </main>
    );
  }

  // ---------- Member view ----------
  // At most one banner under the header, by priority: an update in progress (or its result) >
  // the "you're in" confirmation > an owner adding their reel > a reel that no longer matches
  const banner: "update" | "joined" | "add" | "outdated" | null = autoUpdate
    ? "update"
    : joinedAlone && isMember
      ? "joined"
      : !isMember
        ? "add"
        : statsOutdated || updateStatus
          ? "outdated"
          : null;
  // A member alone in a fresh group has one job, getting it shared, so the invite leads; in every
  // other state (including an owner off the board) it sits below the standings
  const inviteLeads = isFresh && isMember;
  // Display size for names that fit in a button; longer names (up to 60) step down so they wrap well
  const nameFitsDisplay = buttonGroupName === group.name.trim();

  const inviteBlock = (
    <section aria-labelledby="invite-heading" className={inviteLeads ? "mb-12" : "mt-12"}>
      <h2
        id="invite-heading"
        className={isFresh ? "text-title font-semibold" : "text-base font-semibold"}
        style={{ color: "var(--color-text)" }}
      >
        {isFresh ? "Invite your friends" : "Invite more friends"}
      </h2>
      {isFresh && (
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Send them the link or the code. They make their reel, then land right here.
        </p>
      )}
      <p className="mt-5 text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
        Invite code
      </p>
      <div className="mt-2 mb-5">
        <InviteCodeChip code={group.invite_code} size={isFresh ? "lg" : "md"} />
      </div>
      <InviteActions
        code={group.invite_code}
        groupName={group.name}
        ownedByMe={isOwner}
        sharePrimary={primary === "share"}
      />
    </section>
  );

  // Join panel for an owner who created the group before adding their reel
  const joinPanel = !wrappedStats ? (
    <div className="flex flex-col gap-4">
      <h2 className="text-title font-semibold" style={{ color: "var(--color-text)" }}>Make your reel first</h2>
      <p style={{ color: "var(--color-text-secondary)" }}>
        Your reel ends with a link back to {group.name}.
      </p>
      <Link href={uploadWithInviteHref(group.invite_code)} onClick={rememberInvite} className="btn-primary py-3">
        {JOIN_ACTIONS.makeReel}
        <ArrowRightIcon />
      </Link>
      {cancelButton}
    </div>
  ) : !user ? (
    <div className="flex flex-col gap-4">
      <Link href={signInToAddHref} onClick={rememberInvite} className="btn-primary py-3">
        {JOIN_ACTIONS.signInToAdd}
        <ArrowRightIcon />
      </Link>
      {privacyLine}
      {cancelButton}
    </div>
  ) : (
    joinForm
  );

  return (
    <main className="min-h-screen px-6 py-10 overflow-x-clip" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-2xl mx-auto">
        {/* Header: the group's name lands like a reel hero, over the screening-room glow */}
        <header className="mb-10">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 min-h-[44px] pr-3 text-sm mb-4 transition-colors hover:text-[var(--color-text)]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <ArrowLeftIcon size={16} />
            {backLabel}
          </Link>
          <div className="relative isolate">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-16 -inset-y-14 -z-10"
              style={{ background: "var(--glow-hero)" }}
            />
            <h1
              className={`${nameFitsDisplay ? "text-display" : "text-headline"} font-black [overflow-wrap:anywhere]`}
              style={{ color: "var(--color-text)", textWrap: "balance" }}
            >
              {group.name}
            </h1>
          </div>
          {/* Owner only: a quiet rename under the name (the API refuses everyone else with 403) */}
          {isOwner && (
            <div className="mt-2">
              <InlineEdit
                label="Group name"
                value={group.name}
                maxLength={GROUP_NAME_MAX_LENGTH}
                editLabel="Rename group"
                display="button-only"
                onSave={saveGroupName}
              />
            </div>
          )}
          {joinedSinceVisit > 0 && (
            <p role="status" className="mt-4 text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
              {newSinceLastVisitLine(joinedSinceVisit)}
            </p>
          )}
        </header>

        {/* Arrived from the reel's "Update my stats": progress, then the result, at the top */}
        {banner === "update" && (
          <div className="mb-6">
            {updating || (!updateStatus && statsOutdated) ? (
              <p role="status" style={{ color: "var(--color-text-secondary)" }}>
                Updating your stats in {buttonGroupName}…
              </p>
            ) : !updateStatus || updateStatus.ok ? (
              <div role="status" className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "color-mix(in srgb, var(--color-success) 18%, transparent)", color: "var(--color-success)" }}
                >
                  <CheckIcon size={16} />
                </span>
                <p style={{ color: "var(--color-text)" }}>
                  {updateStatus?.text ?? "Your spot already matches this reel. Nothing to update."}
                </p>
              </div>
            ) : (
              <div role="alert" className="flex flex-col gap-3">
                <p style={{ color: "var(--color-red-text)" }}>{updateStatus.text}</p>
                <button type="button" onClick={handleUpdateStats} className="btn-secondary self-start px-5 py-3">
                  {updateStatsLabel(group.name)}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Joined, but nobody to compare against yet: confirm, then the invite leads */}
        {banner === "joined" && (
          <div role="status" className="mb-6 flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--color-success) 18%, transparent)", color: "var(--color-success)" }}
            >
              <CheckIcon size={16} />
            </span>
            <p style={{ color: "var(--color-text)" }}>
              <span className="font-semibold">You&apos;re in.</span>{" "}
              <span style={{ color: "var(--color-text-secondary)" }}>
                Nobody to beat yet. Send the invite and the comparison opens when they join.
              </span>
            </p>
          </div>
        )}

        {/* An owner who isn't on the board: adding their reel is the one red action */}
        {banner === "add" && (
          <section className="mb-10">
            {showJoinForm ? (
              joinPanel
            ) : (
              <button
                onClick={() => setShowJoinForm(true)}
                className={`${primary === "add" ? "btn-primary" : "btn-secondary"} w-full py-4`}
              >
                {JOIN_ACTIONS.addReel}
                <ArrowRightIcon />
              </button>
            )}
          </section>
        )}

        {/* The reel on this device isn't the one the group sees */}
        {banner === "outdated" && (
          <div className="mb-8 flex flex-col gap-2">
            {statsOutdated && (
              <>
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  Your reel on this device doesn&apos;t match your spot here.
                </p>
                <button
                  type="button"
                  onClick={handleUpdateStats}
                  disabled={updating}
                  className="btn-secondary self-start px-5 py-3"
                >
                  {updating ? "Updating…" : updateStatsLabel(group.name)}
                </button>
              </>
            )}
            <p
              aria-live="polite"
              role={updateStatus && !updateStatus.ok ? "alert" : undefined}
              className="text-sm min-h-[1.25rem]"
              style={{ color: updateStatus && !updateStatus.ok ? "var(--color-red-text)" : "var(--color-success)" }}
            >
              {updateStatus?.text ?? ""}
            </p>
          </div>
        )}

        {/* A member alone in a fresh group: getting it shared is the job, so the invite leads */}
        {inviteLeads && inviteBlock}

        {/* Two or more: the head-to-head leads (same model as compare), then a short standings
            preview. The full standings and the awards live on compare, never twice here. */}
        {comparison && (
          <section aria-labelledby="h2h-heading" className="mb-10">
            {comparison.me && (
              <p className="text-headline font-black tabular-nums" style={{ color: "var(--color-text)" }}>
                #{comparison.me.rank}
                <span className="text-title font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                  {" "}
                  of {comparison.ranked.length}
                </span>
              </p>
            )}
            <h2
              id="h2h-heading"
              className="mt-1 text-title font-bold [overflow-wrap:anywhere]"
              style={{ color: "var(--color-text)", textWrap: "balance" }}
            >
              {comparison.headline}
            </h2>
            <p className="mt-1" style={{ color: "var(--color-text-secondary)" }}>
              {comparison.punchline}
            </p>
            <Link
              href={`/groups/${encodeURIComponent(groupId)}/compare`}
              className={`${primary === "compare" ? "btn-primary" : "btn-secondary"} mt-5 w-full px-6 py-3 sm:w-auto`}
            >
              See the full standings
              <ArrowRightIcon />
            </Link>
          </section>
        )}

        {/* Members as ranked roast rows (hidden from non-members: RLS returns none to them) */}
        <section aria-labelledby="members-heading">
          <h2 id="members-heading" className="mb-2 text-title font-semibold" style={{ color: "var(--color-text)" }}>
            {members.length > STANDINGS_PREVIEW
              ? `Top ${STANDINGS_PREVIEW} of ${members.length}`
              : members.length >= 2
                ? "Who watches the most"
                : members.length === 1
                  ? "On the board"
                  : "Nobody yet"}
          </h2>

          {members.length > 0 ? (
            <StandingsList ranked={standings.ranked} metric={standings.metric} limit={STANDINGS_PREVIEW} />
          ) : (
            <p style={{ color: "var(--color-text-secondary)" }}>
              No one has added their reel yet. Add yours, then share the invite so friends can join.
            </p>
          )}
          {members.length === 1 && (
            <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
              Comparing unlocks when a second person joins.
            </p>
          )}
          {members.length > STANDINGS_PREVIEW && (
            <Link
              href={`/groups/${encodeURIComponent(groupId)}/compare`}
              className="mt-2 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold underline underline-offset-4"
              style={{ color: "var(--color-text)" }}
            >
              Everyone, plus the awards
              <ArrowRightIcon size={16} />
            </Link>
          )}
          {/* The viewer's own name, editable in place (shown in the standings, compare and, for an
              owner with the teaser on, the invite page) */}
          {myMember && (
            <div className="mt-4">
              <InlineEdit
                label="Your name"
                value={myMember.nickname}
                maxLength={NICKNAME_MAX_LENGTH}
                editLabel="Edit your name"
                autoComplete="nickname"
                onSave={saveNickname}
              />
            </div>
          )}
        </section>

        {!inviteLeads && inviteBlock}

        {myMember && (
          <LeaveGroup groupId={group.id} groupName={group.name} ownedByMe={isOwner} onLeft={handleLeft} />
        )}
      </div>
    </main>
  );
}

export default function GroupDetailPage() {
  // useSearchParams needs a Suspense boundary
  return (
    <Suspense
      fallback={
        <CenteredMain>
          <p role="status" style={{ color: "var(--color-text-secondary)" }}>
            Loading group…
          </p>
        </CenteredMain>
      }
    >
      <GroupDetail />
    </Suspense>
  );
}
