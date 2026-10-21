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
import InviteCodeChip from "@/components/groups/InviteCodeChip";
import AppNav from "@/components/AppNav";
import { toGroupSummary } from "@/lib/share/safety";
import {
  CREATE_GROUP_INCOMPLETE_MESSAGE,
  GROUP_ACTIONS,
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

// The shared bar, then one column. Each mode brings its own heading; no generic page title.
function PageShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      {/* "Home" leaves the groups flow; the inline Back only steps between modes, so they never overlap */}
      <AppNav secondary={{ href: "/", label: "Home" }} />
      <main className={`w-full mx-auto flex-1 flex flex-col justify-center px-6 py-8 pb-12 ${wide ? "max-w-xl" : "max-w-md"}`}>
        {children}
      </main>
    </div>
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
  // null = user hasn't typed yet, so the personality-based suggestion fills the field.
  // A name typed before signing in rides through the login round trip as ?name=.
  const [typedName, setTypedName] = useState<string | null>(() => searchParams.get("name")?.slice(0, 60) || null);
  // null until the session check returns; signed-out visitors are sent to sign in before naming,
  // never left to discover it from a 401 after typing
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
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
  // Read at click time by actions inside error messages, which outlive the render they came from
  const signedInRef = useRef<boolean | null>(null);

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
      // Early returns still release the body, or the request stays open and never reads as finished
      const done = async (outcome: LookupOutcome): Promise<LookupOutcome> => {
        await res.body?.cancel().catch(() => {});
        return outcome;
      };
      if (res.status === 401) return done({ kind: "signin" });
      if (res.status === 429) return done({ kind: "rate-limited" });
      if (res.status === 404 || res.status === 400) return done({ kind: "not-found" });
      if (!res.ok) return done({ kind: "error" });
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
            No group uses the code <InviteCodeChip code={code} size="inline" />. Check it with whoever sent it,
            or{" "}
            <button
              type="button"
              onClick={startOwnGroup}
              className="inline-flex min-h-11 items-center -my-3 underline underline-offset-2 font-semibold"
            >
              start your own group
            </button>
            .
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

  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (cancelled) return;
        signedInRef.current = Boolean(data.session);
        setSignedIn(Boolean(data.session));
      })
      .catch(() => {
        if (cancelled) return;
        signedInRef.current = false;
        setSignedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function signInToCreateHref(name?: string) {
    const params = new URLSearchParams({ mode: "create" });
    if (name) params.set("name", name);
    return `/auth/login?next=${encodeURIComponent(`/groups?${params.toString()}`)}`;
  }

  // Same rule as the choose screen: signed-out visitors sign in before naming a group
  function startOwnGroup() {
    if (signedInRef.current === false) router.push(signInToCreateHref());
    else goTo("create");
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
    if (!session) {
      // Sign in first; the typed name comes back with them
      router.push(signInToCreateHref(name));
      return;
    }

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
              href={signInToCreateHref(name)}
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

    const group: { id?: unknown; invite_code?: unknown; name?: unknown; warning?: unknown } | null = await res
      .json()
      .catch(() => null);
    // A "created but your stats weren't added" warning, or a body without an id or code, is a
    // failure (same rule as the reel's last slide): nothing is stored and the form stays up
    if (
      !group ||
      group.warning ||
      typeof group.id !== "string" ||
      !group.id ||
      typeof group.invite_code !== "string" ||
      !group.invite_code
    ) {
      setLoading(false);
      setError(CREATE_GROUP_INCOMPLETE_MESSAGE);
      return;
    }
    // setMyGroup stamps the current reel's sessionId, so a later upload can tell the group is stale
    setMyGroup({
      id: group.id,
      inviteCode: group.invite_code,
      name: typeof group.name === "string" && group.name ? group.name : name,
      ownedByMe: true,
    });
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
          Finding the group for code <InviteCodeChip code={joinParam} size="inline" />…
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
          <h1 className="text-headline font-black" style={{ textWrap: "balance" }}>
            Someone in your group chat has a problem.
          </h1>
          <p className="mt-4 text-lg" style={{ color: "var(--color-text-secondary)" }}>
            Put your reels side by side and find out who.
          </p>
          <div className="mt-10 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            <div className="py-5">
              {signedIn === false ? (
                // Same label as the reel's last slide for the same signed-out state
                <Link href={signInToCreateHref()} className="btn-primary w-full py-4 text-lg">
                  {GROUP_ACTIONS.signInAndStart}
                  <ArrowRightIcon />
                </Link>
              ) : (
                <button onClick={() => goTo("create")} className="btn-primary w-full py-4 text-lg">
                  {GROUP_ACTIONS.startMyGroup}
                  <ArrowRightIcon />
                </button>
              )}
              <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
                {signedIn === false
                  ? "A quick sign-in keeps the group yours. Then you get a code to send your friends."
                  : "You get a code to send your friends. Only your stats go in, never your file."}
              </p>
            </div>
            <div className="py-5">
              <button onClick={() => goTo("join")} className="btn-secondary w-full py-4 text-lg">
                {GROUP_ACTIONS.joinWithCode}
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
            {loading ? "Starting…" : signedIn === false ? GROUP_ACTIONS.signInAndStart : INVITE_ACTIONS.startGroup}
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
            {/* With a reel on hand, signing in is the step to adding it: same name as everywhere else */}
            {wrappedStats ? JOIN_ACTIONS.signInToAdd : "Sign in to see the invite"}
            <ArrowRightIcon />
          </Link>
          {!wrappedStats && (
            <Link
              href={uploadWithInviteHref(signInCode)}
              className="self-center inline-flex items-center min-h-[44px] px-3 text-sm underline underline-offset-4"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {JOIN_ACTIONS.makeReel} first
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
