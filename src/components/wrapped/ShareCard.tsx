"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useSyncExternalStore } from "react";
import {
  PLAY_MARK_ASPECT,
  PLAY_MARK_POINTS,
  PLAY_MARK_STROKE,
  inviteLabel,
  pickShareTotal,
  pickTopShowLine,
  shareRoastLine,
  type ShareImageStats,
} from "@/lib/share/renderShareImage";
import { safeInviteCode } from "@/lib/share/safety";

// Older stored stats may lack topShows / totalEpisodesEstimate / hasTimeData; every field is guarded.
export type ShareCardStats = ShareImageStats;

const SMOOTH = [0.4, 0, 0.2, 1] as const;
// Same confident landing as slide 8's stamp: no overshoot.
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
// The personality word lands first; the rest of the card settles in around it.
const T_REST = 0.35;

const noopSubscribe = () => () => {};

/** window.location.host on the client, empty during SSR so hydration matches. */
function useHost(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.host,
    () => ""
  );
}

const PLAY_MARK_PATH = `M${PLAY_MARK_POINTS.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;

/**
 * The Autoplayed play mark, same geometry as the PNG. White here: on slide 10 the CTA is the one red
 * thing; the exported PNG, which carries no CTA, draws it red.
 */
function PlayMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${PLAY_MARK_ASPECT} 1`}
      className="h-[0.72em] w-auto shrink-0"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={PLAY_MARK_STROKE}
      strokeLinejoin="round"
    >
      <path d={PLAY_MARK_PATH} />
    </svg>
  );
}

interface ShareCardProps {
  stats: ShareCardStats;
  /** When set, the card shows the same invite panel the PNG carries. */
  inviteCode?: string;
  /** Viewer created the group: "Join my group" instead of "Join our group". */
  ownedByMe?: boolean;
}

/**
 * On-screen preview of the share PNG (renderShareImage draws the same content in the same order,
 * with the hero in the red gradient):
 * personality hero, roast line, top-show punchline, one total, then the invite panel when there is a code.
 */
export function ShareCard({ stats, inviteCode, ownedByMe }: ShareCardProps) {
  const host = useHost();
  // Scale and blur are motion; reduced motion gets an opacity-only arrival.
  const reduce = useReducedMotion();
  const personality = stats.personality?.trim() || "The Casual Viewer";
  const roast = shareRoastLine(stats);
  const topShowLine = pickTopShowLine(stats);
  const total = pickShareTotal(stats);
  // Same rule as the PNG: a malformed code is never shown or put in a join link.
  const code = safeInviteCode(inviteCode)?.toUpperCase();
  // "~4,046" reads as "tilde 4,046" to screen readers; say "about" instead.
  const totalSpoken = total.value.startsWith("~")
    ? `about ${total.value.slice(1)} ${total.label}`
    : undefined;

  return (
    <motion.section
      aria-label="Your Autoplayed card"
      className="card relative w-full max-w-sm overflow-hidden rounded-[20px] px-6 pt-5 pb-4 text-center short:px-5 short:pt-4 short:pb-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: SMOOTH }}
    >
      {/* One glow source, centered behind the personality hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-6 h-48"
        style={{ background: "var(--glow-hero)" }}
      />

      <div className="relative">
        <p
          className="flex items-center gap-[0.3em] font-black text-title text-left short:text-base"
          style={{ color: "var(--color-text)", letterSpacing: "-0.02em" }}
        >
          <PlayMark />
          Autoplayed
        </p>

        {/*
          Solid white so the primary CTA below stays the one red thing on the slide. The exported
          PNG fills this hero with the red gradient instead: it carries no CTA (see DESIGN.md).
          The payoff of slide 8: the verdict word is carried over, arriving oversized and soft, and
          settles into the card before anything else on it. It is the slide's heading.
        */}
        <motion.h2
          className="mt-4 font-black break-words text-display md:text-headline short:mt-2 short:text-headline"
          style={{ color: "var(--color-text)", textWrap: "balance" }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.3, filter: "blur(8px)" }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={
            reduce
              ? { duration: 0.4, ease: SMOOTH }
              : { duration: 0.6, ease: EASE_OUT_EXPO, opacity: { duration: 0.2 } }
          }
        >
          {personality}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: reduce ? 0.15 : T_REST, ease: SMOOTH }}
        >

          {roast && (
            <p
              className="mt-3 text-sm leading-snug line-clamp-3 short:mt-2 short:line-clamp-1"
              style={{ color: "var(--color-text-secondary)", textWrap: "pretty" }}
            >
              {roast}
            </p>
          )}

          <div
            aria-hidden="true"
            className="mx-auto mt-4 h-px w-2/5 short:mt-3"
            style={{ background: "var(--color-border-strong)" }}
          />

          {topShowLine && (
            <p
              className="mt-4 text-base font-semibold leading-snug break-words [overflow-wrap:anywhere] line-clamp-2 short:mt-3 short:line-clamp-1"
              style={{ color: "var(--color-text)", textWrap: "balance" }}
            >
              {topShowLine}
            </p>
          )}

          <p className="mt-2 flex items-baseline justify-center gap-2">
            {totalSpoken && <span className="sr-only">{totalSpoken}</span>}
            <span
              className="font-black tabular-nums text-headline"
              style={{ color: "var(--color-text)" }}
              aria-hidden={totalSpoken ? true : undefined}
            >
              {total.value}
            </span>
            <span
              aria-hidden={totalSpoken ? true : undefined}
              className="uppercase font-semibold text-xs"
              style={{ color: "var(--color-muted)", letterSpacing: "0.1em" }}
            >
              {total.label}
            </span>
          </p>

          {code && (
            <div
              className="mt-4 rounded-2xl px-4 py-3 short:mt-3 short:py-2"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border-strong)" }}
            >
              <p
                className="uppercase font-semibold text-xs"
                style={{ color: "var(--color-muted)", letterSpacing: "0.1em" }}
              >
                {inviteLabel(ownedByMe)}
              </p>
              <p
                className="mt-1 font-mono font-bold text-title tracking-[0.18em]"
                style={{ color: "var(--color-text)" }}
              >
                {code}
              </p>
              {host && (
                <p className="mt-1 text-xs truncate" style={{ color: "var(--color-text-secondary)" }}>
                  {host}/groups?join={code}
                </p>
              )}
            </div>
          )}

          <p className="mt-4 text-xs short:mt-2" style={{ color: "var(--color-muted)" }}>
            {host && !code ? `${host} · ` : ""}Not affiliated with Netflix.
          </p>
        </motion.div>
      </div>
    </motion.section>
  );
}
