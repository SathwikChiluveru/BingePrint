"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isPendingInviteFresh, updateMyStatsHref, useAutoplayedStore, useMyGroupNeedsUpdate } from "@/lib/store";
import { renderShareImage } from "@/lib/share/renderShareImage";
import { isInAppBrowser, safeInviteCode, toGroupSummary } from "@/lib/share/safety";
import { suggestGroupName, suggestNickname } from "@/components/groups/memberStats";
import { UserPlusIcon } from "@/components/groups/icons";
import {
  GROUP_ACTIONS,
  INVITE_ACTIONS,
  JOIN_ACTIONS,
  createGroupErrorMessage,
  groupNameForButton,
  inviteShareText,
  inviteUrl,
  updateStatsLabel,
} from "@/lib/copy/invite";
import {
  GROUP_NAME_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  renameGroup,
  updateNickname,
} from "@/lib/supabase/groups";
import { upgradeStoredStats } from "@/lib/csv/stats";
import { ShareCard, type ShareCardStats } from "../ShareCard";

const SMOOTH = [0.4, 0, 0.2, 1] as const;
const FILENAME = "autoplayed.png";
const FALLBACK_GROUP_NAME = "My Autoplayed crew";

interface Props {
  stats: ShareCardStats;
  // /wrapped/{sessionId} reads the viewer's own localStorage, so it is never offered as a share
  // link; it is only used to come back here after sign-in.
  sessionId?: string;
  /** Back from sign-in with ?autoshare=1: start the group straight away, then offer "Share it now". */
  autoCreate?: boolean;
}

type ShareState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "creating" }
  | { kind: "createError"; message: string }
  | { kind: "saved"; message: string }
  // In-app browsers ignore downloads: the PNG is shown to press and hold instead.
  | { kind: "preview"; message: string }
  | { kind: "shared" }
  | { kind: "blocked" }
  | { kind: "error" };

type AuthUser = { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null };

const RENDER_ERROR = "Couldn't make your card. Try again.";
const BLOCKED_MESSAGE =
  "Your card is ready, but sharing was blocked. We saved it to your downloads instead.";
const PRESS_AND_HOLD = "Press and hold the card to save it.";
// One line at 375px under the create CTA (the long TEASER_DISCLOSURE wraps to two and pushes the
// secondary row below the fold at 375x548). Same two facts: stats only, and the invite page teaser.
const SHORT_DISCLOSURE = "Stats, never your file. Invites show your name and personality.";
// A slow or hung group check stops waiting after this. The card can be shared without its code
// meanwhile, so the check never holds the CTA.
const GROUP_CHECK_TIMEOUT_MS = 4000;

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

/** "The Binge Lord" reads as "the Binge Lord" mid-sentence. */
function midSentence(personality: string): string {
  return personality.replace(/^The\s+/, "the ");
}

/** Share text for the card alone (no group code), in the roast voice: a dare, not a brag. */
function cardShareText(personality: string): string {
  return `Autoplayed says I'm ${midSentence(personality)}. Think you watch less Netflix than me? Run yours and prove it.`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

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

interface Invite {
  text: string;
  url: string;
}

interface InlineFieldProps {
  id: string;
  label: string;
  value: string;
  maxLength: number;
  /** Saves a changed, trimmed value. Resolves to an error message, or null when it saved. */
  onSave: (next: string) => Promise<string | null>;
}

/**
 * A prefilled value that reads as text and edits in place: Enter or leaving the field saves,
 * Escape puts the saved value back. The parent saves optimistically, so `value` already shows the
 * new text while the request runs; a failure reverts it and the message shows under the field.
 * Never holds up sharing: the share button works whatever state this is in.
 */
function InlineField({ id, label, value, maxLength, onSave }: InlineFieldProps) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  // Follow the saved value (a revert after a failed save, or the stored name coming back trimmed)
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(value);
  }
  const skipBlurRef = useRef(false);

  function commit() {
    const next = draft.trim();
    if (!next || next === value) {
      // Empty never saves: the field goes back to the name it has.
      setDraft(value);
      return;
    }
    setError(null);
    setDraft(next);
    void onSave(next).then((message) => setError(message));
  }

  const errorId = `${id}-error`;
  return (
    <div className="w-full text-left">
      <div className="flex items-center gap-3">
        <label htmlFor={id} className="w-24 shrink-0 text-sm" style={{ color: "var(--color-muted)" }}>
          {label}
        </label>
        <input
          id={id}
          type="text"
          value={draft}
          maxLength={maxLength}
          autoComplete="off"
          enterKeyHint="done"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              skipBlurRef.current = true;
              setDraft(value);
              setError(null);
              e.currentTarget.blur();
            }
          }}
          onBlur={() => {
            if (skipBlurRef.current) {
              skipBlurRef.current = false;
              return;
            }
            commit();
          }}
          // Reads as a value, not a form: a hairline under it, the full field only on hover or focus.
          // The focus ring comes from the global :focus-visible.
          className="min-w-0 flex-1 min-h-[44px] rounded-[6px] border border-transparent border-b-[var(--color-border-strong)] bg-transparent px-2 text-base font-semibold transition-colors hover:border-[var(--color-border)] focus:border-[var(--color-border-strong)] focus:bg-[var(--color-surface-2)]"
          style={{ color: "var(--color-text)" }}
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 pl-[6.75rem] text-sm" style={{ color: "var(--color-red-text)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export function Slide10Share({ stats, sessionId, autoCreate = false }: Props) {
  const router = useRouter();
  const pendingInvite = useAutoplayedStore((s) => s.pendingInvite);
  const myGroup = useAutoplayedStore((s) => s.myGroup);
  const setMyGroup = useAutoplayedStore((s) => s.setMyGroup);
  // The stored group holds stats from an older reel: offer to update them, never a second group.
  const needsUpdate = useMyGroupNeedsUpdate(sessionId);
  // Full stats for the group's wrapped_data; the card itself only needs the ShareCardStats subset
  const wrappedStats = useAutoplayedStore((s) => s.wrappedStats);
  const [share, setShare] = useState<ShareState>({ kind: "idle" });
  // undefined while the session is being read
  const [authUser, setAuthUser] = useState<AuthUser | null | undefined>(undefined);
  // The myGroup id confirmed to still exist, so a deleted group's code never gets baked into the card
  const [checkedGroupId, setCheckedGroupId] = useState<string | null>(null);
  // The myGroup id whose check could not confirm it: ran past GROUP_CHECK_TIMEOUT_MS, failed to reach
  // the server, or got 401/5xx. The card goes out without its code, but the stored group is kept and
  // a late good answer can still confirm it.
  const [unconfirmedGroupId, setUnconfirmedGroupId] = useState<string | null>(null);
  // Name of the group this slide just created; switches the CTA to "Share it now"
  const [createdName, setCreatedName] = useState<string | null>(null);
  // The nickname that group was created with: shown, editable, beside the group name
  const [createdNickname, setCreatedNickname] = useState<string | null>(null);

  // An invite the user arrived through, for a group they have not made their own yet, wins:
  // the comparison is what they came for. Otherwise a group of their own turns sharing into inviting.
  const freshInvite =
    isPendingInviteFresh(pendingInvite) && pendingInvite.code !== myGroup?.inviteCode
      ? pendingInvite
      : null;
  const mode: "stackUp" | "invite" | "create" = freshInvite
    ? "stackUp"
    : myGroup
      ? "invite"
      : "create";
  const groupConfirmed = mode === "invite" && !!myGroup && checkedGroupId === myGroup.id;
  // Validated so a malformed stored code never reaches the card or a URL
  const inviteCode = groupConfirmed ? safeInviteCode(myGroup?.inviteCode) : undefined;
  const ownedByMe = myGroup?.ownedByMe === true;
  // An empty history has nothing to compare: no group creation, no card, just a way to try again.
  const emptyReel = !(Number(stats.totalEpisodesEstimate) > 0) && !(Number(stats.totalHours) > 0);

  // Set synchronously at the start of a create, before any await, so a double tap makes one group
  const creatingRef = useRef(false);
  // Focus lands on "Share it now" once the group exists, so it never drops to <body>
  const shareNowRef = useRef<HTMLButtonElement | null>(null);
  // Object URL of the PNG shown in in-app browsers; revoked when replaced or on unmount
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    let current = true;
    loadUser().then((u) => {
      if (current) setAuthUser(u);
    });
    return () => {
      current = false;
    };
  }, []);

  // Confirm a stored group still exists before its code goes on the card. Only a 2xx confirms it;
  // 404 forgets it; 401, 5xx, a network failure or a timeout leave it unconfirmed, so the card goes
  // out without a code that might be dead.
  useEffect(() => {
    if (!myGroup || checkedGroupId === myGroup.id) return;
    let current = true;
    const id = myGroup.id;
    const timer = setTimeout(() => {
      if (current) setUnconfirmedGroupId(id);
    }, GROUP_CHECK_TIMEOUT_MS);
    fetch(`/api/groups/${encodeURIComponent(id)}`).then(
      (res) => {
        if (!current) return;
        clearTimeout(timer);
        if (res.ok) setCheckedGroupId(id);
        else if (res.status === 404) setMyGroup(null);
        else setUnconfirmedGroupId(id);
      },
      () => {
        if (!current) return;
        clearTimeout(timer);
        setUnconfirmedGroupId(id);
      }
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [myGroup, checkedGroupId, setMyGroup]);

  // Pre-render the PNG so the click can call navigator.share synchronously. iOS Safari drops the
  // tap's user activation across a slow await (or a network request) and rejects share().
  // The card's invite label carries the group name, so a rename re-renders the PNG too
  const cardGroupName = inviteCode ? (myGroup?.name ?? null) : null;
  const renderKey = `${inviteCode ?? ""}|${ownedByMe ? 1 : 0}|${cardGroupName ?? ""}`;
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const blobReady = readyKey === renderKey;
  const blobRef = useRef<Blob | null>(null);
  const pendingRef = useRef<Promise<Blob> | null>(null);
  useEffect(() => {
    // While a stored group is being checked the card renders without its code, so "Share my card"
    // works straight away; a confirmed group re-renders it with the code.
    if (emptyReel) return;
    let current = true;
    blobRef.current = null;
    const pending = renderShareImage(stats, { inviteCode, ownedByMe, groupName: cardGroupName });
    pendingRef.current = pending;
    pending.then(
      (blob) => {
        if (!current) return;
        blobRef.current = blob;
        setReadyKey(renderKey);
      },
      () => {
        // Retried on click.
        if (current) pendingRef.current = null;
      }
    );
    return () => {
      current = false;
    };
  }, [stats, inviteCode, ownedByMe, cardGroupName, renderKey, emptyReel]);

  function goToSignIn() {
    const back = sessionId ? `/wrapped/${sessionId}?autoshare=1` : "/groups?mode=create";
    router.push(`/auth/login?next=${encodeURIComponent(back)}`);
  }

  /** One tap: create the group with this user as its first member, then re-render the card with the code. */
  /** Caller holds creatingRef; returns true when the group exists and has this user's stats. */
  async function createGroup(user: AuthUser): Promise<boolean> {
    setShare({ kind: "creating" });
    // Suggested, then shown as editable fields under "Share it now" so nothing is named silently
    const nickname = suggestNickname(user) || "Me";
    let res: Response;
    try {
      res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: suggestGroupName(stats.personality) || FALLBACK_GROUP_NAME,
          nickname,
          // Summary only: the per-binge session list never leaves the device. Older stored stats
          // get the current personality wording first.
          wrapped_data: toGroupSummary(upgradeStoredStats(wrappedStats ?? stats)),
          // The invite page shows the owner's personality as a hook; the server builds that teaser
          // from wrapped_data. Disclosed in the helper line under the button.
          share_teaser: true,
        }),
      });
    } catch {
      setShare({ kind: "createError", message: createGroupErrorMessage(0) });
      return false;
    }
    if (res.status === 401) {
      setShare({ kind: "idle" });
      goToSignIn();
      return false;
    }
    let group: {
      id?: unknown;
      invite_code?: unknown;
      name?: unknown;
      warning?: unknown;
      members?: unknown;
    } | null = null;
    try {
      group = await res.json();
    } catch {
      group = null;
    }
    const code = safeInviteCode(group?.invite_code);
    // Any non-2xx, a "created but your stats weren't added" warning, or a malformed body is a failure:
    // the card only ever carries a group that really has this user in it.
    if (!res.ok || !group || group.warning || typeof group.id !== "string" || !code) {
      setShare({ kind: "createError", message: createGroupErrorMessage(res.status) });
      return false;
    }
    const name = typeof group.name === "string" && group.name ? group.name : FALLBACK_GROUP_NAME;
    setCheckedGroupId(group.id);
    setMyGroup({ id: group.id, inviteCode: code, name, ownedByMe: true });
    // The stored nickname (trimmed by the server) when the body carries it
    const first = Array.isArray(group.members) ? (group.members[0] as { nickname?: unknown } | undefined) : undefined;
    setCreatedNickname(typeof first?.nickname === "string" && first.nickname ? first.nickname : nickname);
    setCreatedName(name);
    setShare({ kind: "idle" });
    return true;
  }

  /** Optimistic rename: the card and share text use the new name at once; a failure puts it back. */
  async function saveGroupName(next: string): Promise<string | null> {
    const group = useAutoplayedStore.getState().myGroup;
    if (!group) return null;
    const previous = group.name;
    setMyGroup({ ...group, name: next });
    setCreatedName(next);
    const res = await renameGroup(group.id, next);
    const now = useAutoplayedStore.getState().myGroup;
    if (res.ok) {
      if (now?.id === group.id && now.name !== res.name) setMyGroup({ ...now, name: res.name });
      if (now?.id === group.id) setCreatedName(res.name);
      return null;
    }
    // Only revert when nothing newer replaced it meanwhile
    if (now?.id === group.id && now.name === next) {
      setMyGroup({ ...now, name: previous });
      setCreatedName(previous);
    }
    return res.message;
  }

  /** Optimistic nickname change; a failure puts the old one back. */
  async function saveNickname(next: string): Promise<string | null> {
    const group = useAutoplayedStore.getState().myGroup;
    if (!group) return null;
    const previous = createdNickname;
    setCreatedNickname(next);
    const res = await updateNickname(group.id, next);
    if (res.ok) {
      const stored = typeof res.member?.nickname === "string" ? res.member.nickname : next;
      setCreatedNickname((cur) => (cur === next ? stored : cur));
      return null;
    }
    setCreatedNickname((cur) => (cur === next ? previous : cur));
    return res.message;
  }

  async function runCreate(knownUser?: AuthUser | null) {
    if (creatingRef.current) return;
    creatingRef.current = true;
    try {
      const user = knownUser !== undefined ? knownUser : await loadUser();
      if (!user) {
        goToSignIn();
        return;
      }
      await createGroup(user);
    } finally {
      creatingRef.current = false;
    }
  }

  function handleCreateAndInvite() {
    // Guarded inside runCreate before its first await; this check just skips a no-op render.
    if (creatingRef.current) return;
    void runCreate(authUser);
  }

  // Card shared with no group yet: the next step is starting one, so the CTA takes focus
  const createRef = useRef<HTMLButtonElement | null>(null);

  // The create CTA reads as signed out until the session is known (undefined counts as signed out),
  // and only switches to the signed-in wording while it is neither focused nor pressed, so the label
  // never changes under the thumb. A tap before then still works: runCreate reads the session itself.
  const [ctaHeld, setCtaHeld] = useState(false);
  const [ctaSignedIn, setCtaSignedIn] = useState(false);
  if (!ctaHeld && ctaSignedIn !== !!authUser) setCtaSignedIn(!!authUser);
  const createLabel = ctaSignedIn ? INVITE_ACTIONS.startGroup : GROUP_ACTIONS.signInAndStart;
  useEffect(() => {
    if (share.kind === "shared" && mode === "create") createRef.current?.focus();
  }, [share.kind, mode]);

  // Move focus to "Share it now" as soon as it mounts after a create
  useEffect(() => {
    if (createdName) shareNowRef.current?.focus();
  }, [createdName]);

  // Back from sign-in: run the creation the user already asked for. The share sheet still needs a
  // fresh tap ("Share it now"), because the network request ends the original tap's activation.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoCreate || autoStarted.current || authUser === undefined || mode !== "create" || emptyReel) return;
    autoStarted.current = true;
    if (authUser) queueMicrotask(() => void runCreate(authUser));
    // createGroup reads current props and store values; this runs once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreate, authUser, mode, emptyReel]);

  const personalityName = stats.personality?.trim() || "The Casual Viewer";

  function inviteData(): Invite | null {
    if (!inviteCode) return null;
    // The code rides in the text too, so it survives apps that drop the link.
    return {
      text: inviteShareText({
        code: inviteCode,
        groupName: myGroup?.name?.trim() || (ownedByMe ? "my group" : "our group"),
        personality: personalityName,
      }),
      url: inviteUrl(inviteCode),
    };
  }

  /** In-app browsers: show the PNG to press and hold, and copy the invite link (best effort). */
  function previewFallback(blob: Blob, invite: Invite | null) {
    setPreviewUrl(URL.createObjectURL(blob));
    if (invite && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(`${invite.text} ${invite.url}`).then(
        () => setShare({ kind: "preview", message: `${PRESS_AND_HOLD} Invite link copied.` }),
        () => setShare({ kind: "preview", message: PRESS_AND_HOLD })
      );
      return;
    }
    setShare({ kind: "preview", message: PRESS_AND_HOLD });
  }

  /** Saves the PNG, and copies the invite link when there is one (best effort). */
  function saveFallback(blob: Blob, invite: Invite | null, kind: "saved" | "blocked") {
    // A blob download silently does nothing in most in-app browsers, so never claim it worked there.
    if (isInAppBrowser()) {
      previewFallback(blob, invite);
      return;
    }
    downloadBlob(blob, FILENAME);
    if (kind === "blocked") {
      setShare({ kind: "blocked" });
      return;
    }
    if (invite && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(`${invite.text} ${invite.url}`).then(
        () => setShare({ kind: "saved", message: "Card saved to your downloads. Invite link copied." }),
        () => setShare({ kind: "saved", message: "Card saved to your downloads." })
      );
      return;
    }
    setShare({ kind: "saved", message: "Card saved to your downloads." });
  }

  /**
   * Must reach navigator.share() before any await when called from a click, so it stays inside
   * the user activation window.
   */
  function deliver(blob: Blob) {
    const invite = inviteData();
    const file = new File([blob], FILENAME, { type: "image/png" });
    // No code (no group, or an unconfirmed one): the card still travels with a dare and a way in.
    const message = invite ?? { text: cardShareText(personalityName), url: window.location.origin };
    const full: ShareData = { files: [file], title: "My Autoplayed reel", ...message };
    const filesOnly: ShareData = { files: [file], title: "My Autoplayed reel" };
    const data =
      typeof navigator.canShare === "function"
        ? navigator.canShare(full)
          ? full
          : navigator.canShare(filesOnly)
            ? filesOnly
            : null
        : null;

    if (!data) {
      saveFallback(blob, invite, "saved");
      return;
    }

    setShare({ kind: "busy" });
    navigator.share(data).then(
      () => setShare({ kind: "shared" }),
      (err: unknown) => {
        // User closed the share sheet: not an error, just go back to idle.
        if (isAbort(err)) {
          setShare({ kind: "idle" });
          return;
        }
        // NotAllowedError (activation lost) or any other refusal: the card exists, so save it.
        saveFallback(blob, invite, "blocked");
      }
    );
  }

  function handleShare() {
    // Taps while the card is still rendering fall through to render-on-click, which also
    // recovers when the background render failed.
    if (share.kind === "busy" || share.kind === "creating") return;
    const ready = blobRef.current;
    if (ready && blobReady) {
      deliver(ready);
      return;
    }
    // Not rendered yet (or the render failed): render now. If the browser then refuses the
    // late share() call, deliver() falls back to a download.
    setShare({ kind: "busy" });
    const pending =
      pendingRef.current ?? renderShareImage(stats, { inviteCode, ownedByMe, groupName: cardGroupName });
    pendingRef.current = pending;
    pending.then(
      (blob) => {
        blobRef.current = blob;
        deliver(blob);
      },
      () => {
        pendingRef.current = null;
        setShare({ kind: "error" });
      }
    );
  }

  const busy = share.kind === "busy";
  const creating = share.kind === "creating";
  const preparing = createdName !== null && !blobReady;
  const pendingLabel = "Making your card…";
  const statusText =
    share.kind === "busy"
      ? "Making your card…"
      : creating
        ? "Starting your group…"
        : share.kind === "saved" || share.kind === "preview"
          ? share.message
          : share.kind === "shared"
            ? mode === "create"
              ? "Card shared. Now start a group? Friends can join with its code."
              : "Card shared"
            : createdName && blobReady
              ? `${createdName} is ready. Your card now carries its invite code.`
              : createdName
                ? `${createdName} is ready. Making your card with its invite code…`
                : "";

  const shareLabel = createdName
    ? "Share it now"
    : groupConfirmed && inviteCode
      ? INVITE_ACTIONS.shareCardInvite
      : INVITE_ACTIONS.shareCard;
  // aria-disabled rather than disabled, so "Share it now" can hold focus straight after a create;
  // handleShare ignores taps while busy. While a stored group is checked it shares the card alone.
  const shareButton = (primary: boolean) => (
    <button
      ref={primary ? shareNowRef : undefined}
      type="button"
      onClick={handleShare}
      aria-disabled={busy || undefined}
      aria-busy={busy || preparing}
      {...(primary ? { "data-slide-primary": "" } : {})}
      className={`${primary ? "btn-primary" : "btn-secondary"} w-full gap-2 px-6 py-3 aria-disabled:opacity-60 aria-disabled:cursor-wait`}
    >
      <ShareIcon />
      {busy || preparing ? pendingLabel : shareLabel}
    </button>
  );

  // Codes and ids go through validation and encoding, never straight into a URL
  const stackUpCode = freshInvite ? safeInviteCode(freshInvite.code) : undefined;
  const stackUpHref = freshInvite
    ? freshInvite.groupId
      ? `/groups/${encodeURIComponent(freshInvite.groupId)}`
      : stackUpCode
        ? `/groups?join=${encodeURIComponent(stackUpCode)}`
        : "/groups?mode=join"
    : null;
  // Signed out with a known group: straight to sign-in, which returns to the group with its add
  // form open (?add=1), instead of the group's pitch and then sign-in.
  const stackUpSignInHref =
    freshInvite?.groupId && stackUpCode && authUser === null
      ? `/auth/login?next=${encodeURIComponent(
          `/groups/${encodeURIComponent(freshInvite.groupId)}?code=${encodeURIComponent(stackUpCode)}&add=1`
        )}`
      : null;

  // A route into the group once one exists (after a create, after sharing, or an invite already
  // stored). Shown once the check settled or timed out, so a deleted group never flashes a link.
  const groupLinkReady = !!myGroup && (checkedGroupId === myGroup.id || unconfirmedGroupId === myGroup.id);
  const groupHref = myGroup ? `/groups/${encodeURIComponent(myGroup.id)}` : null;
  const groupName = myGroup?.name?.trim() || "your group";
  // After "Card shared" the group is the obvious next step, so the link steps up to a button.
  const groupLinkPromoted = share.kind === "shared";
  const groupLink =
    groupLinkReady && groupHref && myGroup && needsUpdate ? (
      // A newer reel than the one the group has: refresh this member's stats there (secondary).
      <Link href={updateMyStatsHref(myGroup.id)} className="btn-secondary w-full px-6 py-3">
        {updateStatsLabel(myGroup.name)}
      </Link>
    ) : groupLinkReady && groupHref ? (
      <Link
        href={groupHref}
        className={
          groupLinkPromoted
            ? "btn-secondary w-full px-6 py-3"
            : "self-center inline-flex items-center min-h-[44px] px-3 text-sm underline-offset-4 hover:underline"
        }
        style={groupLinkPromoted ? undefined : { color: "var(--color-text-secondary)" }}
      >
        Open {groupName}
      </Link>
    ) : null;

  if (emptyReel) {
    return (
      <div className="slide-container slide-stack items-center px-6 md:px-12">
        <div className="relative w-full max-w-sm flex flex-col items-center text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-16 h-56"
            style={{ background: "var(--glow-hero)" }}
          />
          <motion.h2
            className="relative text-display font-black"
            style={{ color: "var(--color-text)", textWrap: "balance" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: SMOOTH }}
          >
            Nothing to share yet
          </motion.h2>
          <motion.p
            className="relative mt-4 text-base max-w-xs"
            style={{ color: "var(--color-text-secondary)", textWrap: "pretty" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2, ease: SMOOTH }}
          >
            Your file had no viewing history in it, so there is no card to brag with. Grab a fresh
            export from Netflix and run it again.
          </motion.p>
          <motion.div
            className="relative mt-8 w-full flex flex-col gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35, ease: SMOOTH }}
          >
            <Link href="/upload" data-slide-primary="" className="btn-primary w-full px-6 py-3">
              Upload my history
            </Link>
            {groupLink ?? (
              <Link
                href="/groups?mode=join"
                className="self-center inline-flex items-center min-h-[44px] px-3 text-sm underline-offset-4 hover:underline"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Join with a code
              </Link>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="slide-container slide-stack items-center px-4 md:px-12">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        {previewUrl && share.kind === "preview" ? (
          <>
            {/* The card's own heading (its personality) is not on screen while the PNG stands in */}
            <h2 className="sr-only">Your Autoplayed card</h2>
            {/* The rendered PNG itself, so press-and-hold saves the real card in in-app browsers */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={`Your Autoplayed card: ${stats.personality?.trim() || "The Casual Viewer"}. ${PRESS_AND_HOLD}`}
              width={1080}
              height={1920}
              className="h-auto w-auto max-w-full max-h-[52vh] rounded-[20px] short:max-h-[44vh]"
              style={{ border: "1px solid var(--color-border-strong)", WebkitTouchCallout: "default" }}
            />
          </>
        ) : (
          <ShareCard stats={stats} inviteCode={inviteCode} ownedByMe={ownedByMe} groupName={cardGroupName} />
        )}

        <motion.div
          className="mt-5 w-full flex flex-col gap-3 short:mt-2 short:gap-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5, ease: SMOOTH }}
        >
          {mode === "create" && (
            <p className="text-base font-semibold short:hidden" style={{ color: "var(--color-text)" }}>
              Think your friends watch less? Prove it.
            </p>
          )}

          {mode === "stackUp" && stackUpHref && freshInvite ? (
            <>
              {stackUpSignInHref ? (
                <Link href={stackUpSignInHref} data-slide-primary="" className="btn-primary w-full px-6 py-3">
                  {JOIN_ACTIONS.signInToAdd}
                </Link>
              ) : (
                <Link href={stackUpHref} data-slide-primary="" className="btn-primary w-full px-6 py-3">
                  See how you stack up in {groupNameForButton(freshInvite.groupName)}
                </Link>
              )}
              {shareButton(false)}
            </>
          ) : mode === "create" ? (
            <>
              {/* The one red thing on this slide: makes the group, then the card carries its code */}
              <button
                ref={createRef}
                type="button"
                onClick={handleCreateAndInvite}
                onFocus={() => setCtaHeld(true)}
                onBlur={() => setCtaHeld(false)}
                onPointerDown={() => setCtaHeld(true)}
                onPointerLeave={() => {
                  if (document.activeElement !== createRef.current) setCtaHeld(false);
                }}
                disabled={creating}
                aria-busy={creating}
                data-slide-primary=""
                className="btn-primary w-full gap-2 px-6 py-3 disabled:opacity-60 disabled:cursor-wait"
              >
                <UserPlusIcon />
                {creating ? "Starting your group…" : createLabel}
              </button>
              <p className="text-xs leading-4" style={{ color: "var(--color-muted)", textWrap: "balance" }}>
                {SHORT_DISCLOSURE}
              </p>
              {/*
                One secondary row. Joining stays a real button, not a footnote: someone holding a
                friend's code must not start a rival group by default. Sharing the card alone is the
                quiet option beside it.
              */}
              <div className="flex items-stretch gap-2">
                <Link
                  href="/groups?mode=join"
                  className="btn-secondary flex-1 min-w-0 min-h-[44px] px-4 py-2 text-center text-sm leading-tight"
                >
                  Join a friend&rsquo;s group
                </Link>
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={busy || creating}
                  className="shrink-0 inline-flex items-center justify-center min-h-[44px] px-3 text-sm underline-offset-4 hover:underline disabled:opacity-60"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {busy ? "Making your card…" : INVITE_ACTIONS.shareCard}
                </button>
              </div>
            </>
          ) : (
            <>
              {shareButton(true)}
              {/*
                Just created: the suggested group name and nickname, shown and editable in place, so
                nothing is named silently. "Share it now" above accepts them as they are.
              */}
              {createdName && myGroup && (
                <div className="w-full flex flex-col gap-1">
                  {ownedByMe && (
                    <InlineField
                      id="created-group-name"
                      label="Group name"
                      value={myGroup.name}
                      maxLength={GROUP_NAME_MAX_LENGTH}
                      onSave={saveGroupName}
                    />
                  )}
                  {createdNickname !== null && (
                    <InlineField
                      id="created-nickname"
                      label="Your name"
                      value={createdNickname}
                      maxLength={NICKNAME_MAX_LENGTH}
                      onSave={saveNickname}
                    />
                  )}
                </div>
              )}
            </>
          )}

          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {statusText}
          </p>
          {createdName && blobReady && share.kind === "idle" && (
            <p className="text-sm" style={{ color: "var(--color-success)" }} aria-hidden="true">
              {statusText}
            </p>
          )}
          {(share.kind === "saved" || share.kind === "shared" || share.kind === "preview") && (
            <p className="text-sm" style={{ color: "var(--color-success)" }} aria-hidden="true">
              {statusText}
            </p>
          )}
          {share.kind === "blocked" && (
            <p role="status" className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {BLOCKED_MESSAGE}
            </p>
          )}
          {share.kind === "error" && (
            <p role="alert" className="text-sm" style={{ color: "var(--color-red-text)" }}>
              {RENDER_ERROR}
            </p>
          )}
          {share.kind === "createError" && (
            <p role="alert" className="text-sm" style={{ color: "var(--color-red-text)" }}>
              {share.message}
            </p>
          )}

          {groupLink}

          {/* The on-device receipts (money, plan value, account check). Quiet, never a CTA. */}
          {sessionId && (
            <Link
              href={`/wrapped/${encodeURIComponent(sessionId)}/receipts`}
              className="self-center inline-flex items-center min-h-[44px] px-3 text-sm underline-offset-4 hover:underline short:hidden!"
              style={{ color: "var(--color-text-secondary)" }}
            >
              See the receipts
            </Link>
          )}

          {/*
            Overflow, not an action: hidden on short screens, and in create mode below md so the
            phone layout stays card, tease, CTA, disclosure, one secondary row.
          */}
          <Link
            href="/upload"
            className={`self-center items-center min-h-[44px] px-3 text-sm underline-offset-4 hover:underline short:hidden! ${mode === "create" ? "hidden md:inline-flex" : "inline-flex"}`}
            style={{ color: "var(--color-muted)" }}
          >
            Upload a different file
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
