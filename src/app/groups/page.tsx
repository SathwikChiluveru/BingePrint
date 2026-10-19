"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { isPendingInviteFresh, useAutoplayedStore } from "@/lib/store";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/groups/icons";
import { suggestGroupName, suggestNickname } from "@/components/groups/memberStats";
import InviteFrame, { InAppInvite, NetflixFileSteps, useInAppBrowser } from "@/components/groups/InviteFrame";
import MyGroupsList from "@/components/groups/MyGroupsList";
import { toGroupSummary } from "@/lib/share/safety";
import {
  INVITE_ACTIONS,
  INVITE_CODE_FORMAT_ERROR,
  JOIN_ACTIONS,
  TEASER_CHECKBOX_LABEL,
  createGroupErrorMessage,
  teaserFormDisclosure,
  uploadWithInviteHref,
} from "@/lib/copy/invite";
import {
  INVITE_CODE_MAX_LENGTH,
  INVITE_CODE_PLACEHOLDER,
  displayInviteCode,
  isValidInviteCode,
  normalizeInviteCode,
  type GroupPreview,
} from "@/lib/supabase/groups";

type Mode = "choose" | "create" | "join" | "needs-upload" | "needs-signin";

type LookupOutcome =
  | { kind: "found"; group: GroupPreview }
  | { kind: "not-found" }
  | { kind: "signin" }
  | { kind: "rate-limited" }
  | { kind: "timeout" }
  | { kind: "error" };

// "Finding the group…" never hangs longer than this; the join form comes back with a retry message
const LOOKUP_TIMEOUT_MS = 10_000;

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
  caretColor: "var(--color-red)",
};

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="text-sm p-3 rounded-xl"
      style={{
        background: "var(--color-red-subtle)",
        border: "1px solid var(--color-red-border)",
        color: "var(--color-red-text)",
      }}
    >
      {children}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 min-h-[44px] text-sm self-center px-3"
      style={{ color: "var(--color-muted)" }}
    >
      <ArrowLeftIcon size={16} />
      Back
    </button>
  );
}

// Wordmark home, then one column. Each mode brings its own heading; no generic page title.
function PageShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-screen flex flex-col px-6 pt-3 pb-12" style={{ background: "var(--color-bg)" }}>
      <div className={`w-full mx-auto ${wide ? "max-w-xl" : "max-w-md"}`}>
        <Link
          href="/"
          className="-ml-2 inline-flex items-center min-h-[44px] px-2 text-lg font-black"
          style={{ color: "var(--color-text)" }}
        >
          Autoplayed
        </Link>
      </div>
      <div className={`w-full mx-auto flex-1 flex flex-col justify-center py-8 ${wide ? "max-w-xl" : "max-w-md"}`}>
        {children}
      </div>
    </main>
  );
}

function GroupsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only a well-formed code is ever used or shown; anything else in ?join= is treated as absent
  const rawJoin = normalizeInviteCode(searchParams.get("join"));
  const joinParam = isValidInviteCode(rawJoin) ? rawJoin : "";
  const badJoinParam = rawJoin !== "" && !joinParam;
  const modeParam = searchParams.get("mode");

  const wrappedStats = useAutoplayedStore((s) => s.wrappedStats);
  const pendingInvite = useAutoplayedStore((s) => s.pendingInvite);
  const setPendingInvite = useAutoplayedStore((s) => s.setPendingInvite);
  const setMyGroup = useAutoplayedStore((s) => s.setMyGroup);
  const inApp = useInAppBrowser();

  const [mode, setMode] = useState<Mode>(() =>
    joinParam || badJoinParam ? "join" : modeParam === "create" ? "create" : modeParam === "join" ? "join" : "choose"
  );
  // null = user hasn't typed yet, so the personality-based suggestion fills the field
  const [typedName, setTypedName] = useState<string | null>(null);
  // On by default, disclosed next to the checkbox (same default as the reel's one-tap create)
  const [shareTeaser, setShareTeaser] = useState(true);
  const [inviteCode, setInviteCode] = useState(joinParam);
  const [invitedTo, setInvitedTo] = useState<GroupPreview | null>(null);
  const [signInCode, setSignInCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode>(
    badJoinParam ? "That invite link looks broken. Type the code your friend sent you instead." : null
  );
  const autoJoinStarted = useRef(false);

  const suggestedName = suggestGroupName(wrappedStats?.personality);
  const groupName = typedName ?? suggestedName;
  // Starting a group while holding a fresh invite usually means the invite got lost: offer it back
  const heldInvite = isPendingInviteFresh(pendingInvite) ? pendingInvite : null;

  // Invite lookup goes through the rate-limited API (RPC group_by_invite_code), never a table read
  async function findGroup(code: string): Promise<LookupOutcome> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    try {
      const res = await fetch(`/api/groups/lookup?code=${encodeURIComponent(code)}`, { signal: controller.signal });
      if (res.status === 401) return { kind: "signin" };
      if (res.status === 429) return { kind: "rate-limited" };
      if (res.status === 404 || res.status === 400) return { kind: "not-found" };
      if (!res.ok) return { kind: "error" };
      return { kind: "found", group: (await res.json()) as GroupPreview };
    } catch {
      return controller.signal.aborted ? { kind: "timeout" } : { kind: "error" };
    } finally {
      clearTimeout(timer);
    }
  }

  async function joinByCode(code: string) {
    setLoading(true);
    setError(null);
    if (!isValidInviteCode(code)) {
      setLoading(false);
      setMode("join");
      setError(INVITE_CODE_FORMAT_ERROR);
      return;
    }
    const outcome = await findGroup(code);
    if (outcome.kind !== "found") {
      setLoading(false);
      if (outcome.kind === "signin") {
        // Keep the code so the group page and the wrapped ending can bring them back after sign-in
        setPendingInvite({ code });
        setSignInCode(code);
        setMode("needs-signin");
        return;
      }
      setMode("join");
      setError(
        outcome.kind === "not-found" ? (
          <>
            No group uses the code <span className="font-mono">{displayInviteCode(code)}</span>. Check it with whoever sent it,
            or start your own group.
          </>
        ) : outcome.kind === "rate-limited" ? (
          "Too many tries, wait a minute. Codes are rate limited to stop guessing. Your invite still works."
        ) : outcome.kind === "timeout" ? (
          "Autoplayed took too long to answer. Check your connection, then tap Find group again."
        ) : (
          "Couldn't reach Autoplayed. Check your connection and try again."
        )
      );
      return;
    }

    const group = outcome.group;
    // Remember the invite: the group page opens its join form, and the wrapped ending links back here
    setPendingInvite({ code, groupName: group.name, groupId: group.id });

    if (!wrappedStats) {
      setLoading(false);
      setInvitedTo(group);
      setMode("needs-upload");
      return;
    }

    // The code rides along so the preview (and the join form) works signed out and survives sign-in
    router.push(`/groups/${encodeURIComponent(group.id)}?code=${encodeURIComponent(code)}`);
  }

  // Opened from an invite link: look the group up straight away
  useEffect(() => {
    if (!joinParam || autoJoinStarted.current) return;
    autoJoinStarted.current = true;
    void joinByCode(joinParam);
    // Runs once per invite code; joinByCode reads current store values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinParam]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = groupName.trim();
    if (!name) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    let res: Response;
    try {
      res = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        // With stats on hand the creator joins in the same request, so they land on the invite view
        body: JSON.stringify(
          wrappedStats
            ? {
                name,
                nickname: suggestNickname(session?.user ?? null) || "Me",
                wrapped_data: toGroupSummary(wrappedStats),
                share_teaser: shareTeaser,
              }
            : { name }
        ),
      });
    } catch {
      setLoading(false);
      setError("Couldn't reach Autoplayed. Check your connection and try again.");
      return;
    }

    if (!res.ok) {
      setLoading(false);
      if (res.status === 401) {
        setError(
          <>
            You need to sign in to create a group.{" "}
            <Link
              href={`/auth/login?next=${encodeURIComponent("/groups?mode=create")}`}
              className="underline underline-offset-2 font-semibold"
            >
              Sign in
            </Link>{" "}
            and you&apos;ll come right back here.
          </>
        );
        return;
      }
      setError(createGroupErrorMessage(res.status));
      return;
    }

    const group = await res.json();
    // setMyGroup stamps the current reel's sessionId, so a later upload can tell the group is stale
    setMyGroup({ id: group.id, inviteCode: group.invite_code, name: group.name, ownedByMe: true });
    router.push(`/groups/${encodeURIComponent(group.id)}`);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeInviteCode(inviteCode);
    if (!code) return;
    await joinByCode(code);
  }

  function goTo(next: Mode) {
    setError(null);
    setMode(next);
  }

  const enter = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const },
  };

  // Invite link opened: show a quiet status while the code is checked
  if (joinParam && mode === "join" && loading && !error) {
    return (
      <PageShell>
        <p role="status" className="text-center" style={{ color: "var(--color-text-secondary)" }}>
          Finding the group for code <span className="font-mono">{displayInviteCode(joinParam)}</span>…
        </p>
      </PageShell>
    );
  }

  if (mode === "needs-upload") {
    const code = invitedTo?.invite_code ?? joinParam;
    return (
      <PageShell wide>
        <InviteFrame groupName={invitedTo?.name ?? "a group"} teaser={invitedTo?.owner_teaser ?? null}>
          {inApp && code ? (
            <>
              <InAppInvite code={code} />
              <Link
                href={uploadWithInviteHref(code)}
                className="self-center inline-flex items-center min-h-[44px] px-3 text-sm underline underline-offset-4"
                style={{ color: "var(--color-text-secondary)" }}
              >
                I already have my file
              </Link>
            </>
          ) : (
            <>
              <Link href={code ? uploadWithInviteHref(code) : "/upload"} className="btn-primary py-3 text-lg">
                {JOIN_ACTIONS.makeReel}
                <ArrowRightIcon />
              </Link>
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                Make your reel, then it brings you back to this group.
              </p>
              <div className="mt-4">
                <NetflixFileSteps />
              </div>
            </>
          )}
          <BackButton onClick={() => goTo("join")} />
        </InviteFrame>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {mode === "choose" && (
        <motion.div className="flex flex-col" {...enter}>
          <h1
            className="font-black"
            style={{ fontSize: "clamp(2.25rem, 8vw, 3.5rem)", lineHeight: 0.98, letterSpacing: "-0.03em", textWrap: "balance" }}
          >
            Someone in your group chat has a problem.
          </h1>
          <p className="mt-4 text-lg" style={{ color: "var(--color-text-secondary)" }}>
            Put your reels side by side and find out who.
          </p>
          <div className="mt-10 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            <div className="py-5">
              <button onClick={() => goTo("create")} className="btn-primary w-full py-4 text-lg">
                Start a group
                <ArrowRightIcon />
              </button>
              <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
                You get a code to send your friends. Only your stats go in, never your file.
              </p>
            </div>
            <div className="py-5">
              <button onClick={() => goTo("join")} className="btn-secondary w-full py-4 text-lg">
                Join with a code
              </button>
              <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
                A friend sent you a code? This is where it goes.
              </p>
            </div>
          </div>
          <MyGroupsList />
        </motion.div>
      )}

      {mode === "create" && (
        <motion.form onSubmit={handleCreate} className="flex flex-col gap-4" {...enter}>
          <div>
            <h1 className="text-headline font-bold" style={{ color: "var(--color-text)" }}>Name your group</h1>
            <p className="mt-2" style={{ color: "var(--color-text-secondary)" }}>
              {wrappedStats
                ? "Your reel goes in first, then you get an invite code to send your friends."
                : "You'll get an invite code to send your friends next."}
            </p>
          </div>
          {heldInvite && (
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              You were invited to {heldInvite.groupName ?? "a group"}.{" "}
              <Link
                href={`/groups?join=${encodeURIComponent(heldInvite.code)}`}
                className="underline underline-offset-2 font-semibold"
                style={{ color: "var(--color-text)" }}
              >
                Join that instead
              </Link>
            </p>
          )}
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
              Group name
            </span>
            <input
              type="text"
              required
              maxLength={60}
              placeholder="e.g. Friday night crew"
              value={groupName}
              onChange={(e) => setTypedName(e.target.value)}
              className="w-full min-h-[44px] px-4 py-3 rounded-xl text-base"
              style={inputStyle}
            />
          </label>
          {wrappedStats && (
            <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={shareTeaser}
                onChange={(e) => setShareTeaser(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0"
                style={{ accentColor: "var(--color-red)" }}
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{TEASER_CHECKBOX_LABEL}</span>
                <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                  {teaserFormDisclosure(wrappedStats.personality, wrappedStats.hasTimeData)}
                </span>
              </span>
            </label>
          )}
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Only your stats are shared with the group, never your file.
          </p>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button type="submit" disabled={loading || !groupName.trim()} className="btn-primary py-3">
            {loading ? "Starting…" : INVITE_ACTIONS.startGroup}
            {!loading && <ArrowRightIcon />}
          </button>
          <BackButton onClick={() => goTo("choose")} />
        </motion.form>
      )}

      {mode === "join" && (
        <motion.form onSubmit={handleJoin} className="flex flex-col gap-4" {...enter}>
          <div>
            <h1 className="text-headline font-bold" style={{ color: "var(--color-text)" }}>Join a group</h1>
            <p className="mt-2" style={{ color: "var(--color-text-secondary)" }}>
              Enter the code your friend sent you.
            </p>
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
              Invite code
            </span>
            <input
              type="text"
              required
              maxLength={INVITE_CODE_MAX_LENGTH + 2}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={INVITE_CODE_PLACEHOLDER}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full min-h-[44px] px-4 py-3 rounded-xl text-lg font-mono uppercase tracking-[0.3em]"
              style={inputStyle}
            />
          </label>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button type="submit" disabled={loading || !inviteCode.trim()} className="btn-primary py-3">
            {loading ? "Finding group…" : "Find group"}
            {!loading && <ArrowRightIcon />}
          </button>
          <BackButton onClick={() => goTo("choose")} />
        </motion.form>
      )}

      {mode === "needs-signin" && signInCode && (
        <motion.div className="flex flex-col gap-4" {...enter}>
          <h1 className="text-headline font-bold" style={{ color: "var(--color-text)" }}>
            You&apos;re invited to an Autoplayed group
          </h1>
          <p style={{ color: "var(--color-text-secondary)" }}>
            Groups are private. Sign in to see which group this is and who&apos;s in it. You&apos;ll come right back.
          </p>
          <Link
            href={`/auth/login?next=${encodeURIComponent(`/groups?join=${encodeURIComponent(signInCode)}`)}`}
            className="btn-primary py-3"
          >
            Sign in to see the invite
            <ArrowRightIcon />
          </Link>
          {!wrappedStats && (
            <Link
              href={uploadWithInviteHref(signInCode)}
              className="self-center inline-flex items-center min-h-[44px] px-3 text-sm underline underline-offset-4"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Make my reel first
            </Link>
          )}
        </motion.div>
      )}
    </PageShell>
  );
}

export default function GroupsPage() {
  // useSearchParams needs a Suspense boundary so the shell can prerender
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="text-center" role="status" style={{ color: "var(--color-text-secondary)" }}>
            Loading…
          </p>
        </PageShell>
      }
    >
      <GroupsContent />
    </Suspense>
  );
}
