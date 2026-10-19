"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAutoplayedStore, useMyGroupNeedsUpdate } from "@/lib/store";
import { fetchMyGroups, type MyGroupSummary } from "@/lib/supabase/groups";
import { ArrowRightIcon } from "./icons";

type State =
  | { kind: "loading" }
  | { kind: "hidden" } // signed out, or no groups yet: the start/join choice is the whole page
  | { kind: "ready"; groups: MyGroupSummary[] }
  | { kind: "failed"; rateLimited: boolean };

function peopleLine(count: number) {
  if (count <= 0) return "Nobody on the board yet";
  if (count === 1) return "Just you so far";
  return `${count.toLocaleString()} people`;
}

/**
 * "Your groups": the return path to every group the signed-in user owns or is in (GET /api/groups).
 * Renders nothing while loading, when signed out, or with no groups, so the choice screen never
 * flashes an empty section.
 */
export default function MyGroupsList() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const myGroup = useAutoplayedStore((s) => s.myGroup);
  const myGroupStale = useMyGroupNeedsUpdate();

  useEffect(() => {
    const controller = new AbortController();
    fetchMyGroups({ signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) {
        setState(result.groups.length > 0 ? { kind: "ready", groups: result.groups } : { kind: "hidden" });
      } else if (result.reason === "signed-out") {
        setState({ kind: "hidden" });
      } else {
        setState({ kind: "failed", rateLimited: result.reason === "rate-limited" });
      }
    });
    return () => controller.abort();
  }, [attempt]);

  if (state.kind === "loading" || state.kind === "hidden") return null;

  return (
    <section aria-labelledby="my-groups-heading" className="mt-12">
      <h2 id="my-groups-heading" className="text-title font-semibold" style={{ color: "var(--color-text)" }}>
        Your groups
      </h2>
      {state.kind === "failed" ? (
        <div role="alert" className="mt-2 flex flex-wrap items-center gap-x-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          <span>
            {state.rateLimited
              ? "Too many refreshes. Wait a minute, then try again."
              : "Couldn't load your groups. Check your connection."}
          </span>
          <button
            type="button"
            onClick={() => {
              setState({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
            className="min-h-[44px] font-semibold underline underline-offset-4"
            style={{ color: "var(--color-text)" }}
          >
            Try again
          </button>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {state.groups.map((g) => {
            const needsUpdate = myGroupStale && myGroup?.id === g.id && g.isMember;
            const notes = [
              peopleLine(g.memberCount),
              g.ownedByMe ? "You started it" : null,
              g.ownedByMe && !g.isMember ? "Your reel isn't on the board" : null,
              needsUpdate ? "Your stats here are from an older reel" : null,
            ].filter(Boolean);
            return (
              <li key={g.id}>
                <Link
                  href={`/groups/${encodeURIComponent(g.id)}`}
                  className="group flex min-h-[56px] items-center gap-4 py-3 transition-colors"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className="truncate font-semibold transition-colors group-hover:text-[var(--color-text)]"
                      style={{ color: "var(--color-text)" }}
                      title={g.name}
                    >
                      {g.name}
                    </span>
                    <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                      {notes.join(" · ")}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 transition-transform group-hover:translate-x-0.5"
                    style={{ color: "var(--color-muted)" }}
                  >
                    <ArrowRightIcon />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
