"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useAutoplayedStore } from "@/lib/store";

const noopSubscribe = () => () => {};

/**
 * "Back to my reel" for returning visitors. The reel lives in localStorage, so the link renders
 * only after hydration. Until then (and for visitors without a reel) an invisible copy of the label
 * holds the same box, so the nav never shifts when the link appears.
 */
export function ReturningReelLink() {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
  const sessionId = useAutoplayedStore((s) => s.sessionId);
  const hasStats = useAutoplayedStore((s) => s.wrappedStats !== null);

  const label = (
    <>
      <span className="hidden sm:inline">Back to my reel</span>
      <span className="sm:hidden">My reel</span>
    </>
  );
  const box = "inline-flex min-h-11 items-center px-2 text-sm font-semibold";

  if (!isClient || !sessionId || !hasStats) {
    return (
      <span aria-hidden="true" className={`${box} invisible`}>
        {label}
      </span>
    );
  }

  return (
    <Link
      href={`/wrapped/${encodeURIComponent(sessionId)}`}
      className={`${box} underline-offset-4 hover:underline`}
      style={{ color: "var(--color-text)" }}
    >
      {label}
    </Link>
  );
}
