"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CompareView from "@/components/compare/CompareView";
import { CompareError, CompareSkeleton, CompareSolo, type LoadError } from "@/components/compare/CompareStates";
import { buildComparison } from "@/components/compare/compareModel";
import type { Group } from "@/types";

// A hung request never leaves the skeleton up longer than this; the error state offers a retry
const LOAD_TIMEOUT_MS = 12_000;

type State =
  | { status: "loading" }
  | { status: "error"; error: LoadError }
  | { status: "ready"; group: Group; userId: string | null };

async function loadUserId(): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await createClient().auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function ComparePageInner() {
  const params = useParams();
  const groupId = params.groupId as string;
  const searchParams = useSearchParams();
  // ?joined=1 comes from the join form. Read once, then dropped from the URL so a reload or a
  // shared link never replays the welcome.
  const [justJoined] = useState(() => searchParams.get("joined") === "1");
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!justJoined) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("joined");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [justJoined]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
    // Members only: the API returns every member just to people in the group (RLS). No ?code= here,
    // so non-members get a 404 and are sent to the group page, which handles invites and sign-in.
    async function load() {
      try {
        const [res, userId] = await Promise.all([
          fetch(`/api/groups/${encodeURIComponent(groupId)}`, { cache: "no-store", signal: controller.signal }),
          loadUserId(),
        ]);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 401) return setState({ status: "error", error: { kind: "signin" } });
        if (res.status === 404 || (res.ok && data.preview)) {
          return setState({ status: "error", error: { kind: "not-member" } });
        }
        if (!res.ok || data.error) return setState({ status: "error", error: { kind: "failed" } });
        setState({ status: "ready", group: data as Group, userId });
      } catch {
        if (!cancelled) setState({ status: "error", error: { kind: "failed" } });
      } finally {
        clearTimeout(timer);
      }
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [groupId, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const comparison = useMemo(() => {
    if (state.status !== "ready") return null;
    const members = state.group.members ?? [];
    return members.length >= 2 ? buildComparison(members, state.userId) : null;
  }, [state]);

  if (state.status === "loading") return <CompareSkeleton />;
  if (state.status === "error") return <CompareError groupId={groupId} error={state.error} onRetry={retry} />;
  const ownedByMe = !!state.userId && state.group.owner_id === state.userId;
  if (!comparison) return <CompareSolo group={state.group} ownedByMe={ownedByMe} />;
  return <CompareView group={state.group} comparison={comparison} ownedByMe={ownedByMe} justJoined={justJoined} />;
}

export default function ComparePage() {
  // useSearchParams needs a Suspense boundary so the shell can prerender
  return (
    <Suspense fallback={<CompareSkeleton />}>
      <ComparePageInner />
    </Suspense>
  );
}
