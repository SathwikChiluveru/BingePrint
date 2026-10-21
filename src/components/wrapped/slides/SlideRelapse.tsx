"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { RelapseShow, WrappedStats } from "@/types";

type RelapseStats = Pick<WrappedStats, "insights">;

interface Props {
  stats: RelapseStats;
}

const EASE_SMOOTH = [0.4, 0, 0.2, 1] as const;
const EASE_SPRING = [0.34, 1.56, 0.64, 1] as const;

const kickerStyle = { letterSpacing: "0.1em", color: "var(--color-muted)" } as const;

const DAY_MS = 86_400_000;

/** Relapses worth showing, worst offender first. Older stored stats have no insights at all. */
function relapsesOf(stats: RelapseStats | null | undefined): RelapseShow[] {
  const list = stats?.insights?.relapses;
  if (!Array.isArray(list)) return [];
  return list
    .filter((r) => r && typeof r.title === "string" && r.title.length > 0 && (r.restarts ?? 0) > 0)
    .slice()
    .sort((a, b) => b.restarts - a.restarts);
}

export function hasRelapses(stats: RelapseStats | null | undefined): boolean {
  return relapsesOf(stats).length > 0;
}

function timesWord(n: number): string {
  return n === 1 ? "time" : "times";
}

/** One sentence for the reel's screen-reader live region. */
export function relapseSummary(stats: RelapseStats | null | undefined): string {
  const top = relapsesOf(stats)[0];
  if (!top) return "Relapse: nothing to report";
  const verb = top.kind === "movie" ? "watched" : "restarted";
  return `Relapse: ${top.title} ${verb} ${top.restarts.toLocaleString()} ${timesWord(top.restarts)}`;
}

/** "YYYY-MM-DD" as a UTC midnight timestamp, so day math and labels never shift with the time zone. */
function dayStamp(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : null;
}

function formatDay(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** End label under the rail: the year, or month and year when the whole log sits inside one year. */
function endLabel(t: number, sameYear: boolean): string {
  return sameYear
    ? new Date(t).toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" })
    : String(new Date(t).getUTCFullYear());
}

/** Teases the habit, never the person. The hero already states the count, so lines don't repeat it. */
function relapseQuip(top: RelapseShow): string {
  if (top.kind === "movie") {
    return top.restarts >= 6
      ? "It ends the same way. You have checked. Repeatedly."
      : "It ends the same way. You checked anyway.";
  }
  if (top.restarts >= 10) return "At this point it's not a rewatch. It's a support group.";
  if (top.rewatchedEpisodes >= 25) {
    return `${top.rewatchedEpisodes.toLocaleString()} episodes seen more than once. You could do the dialogue from memory.`;
  }
  if (top.restarts >= 3) return "Every restart begins with “just the pilot.” It is never just the pilot.";
  if (top.restarts === 1) return "One relapse on record. Admitting it is the first step.";
  return "You know how it ends. You started over anyway.";
}

interface Mark {
  t: number;
  pct: number;
}

/** Places each dated entry on a 0-100 rail spanning the first and last dates. */
function layoutMarks(timeline: string[]): { marks: Mark[]; spanDays: number } {
  const stamps = timeline
    .map(dayStamp)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  if (stamps.length === 0) return { marks: [], spanDays: 0 };
  const first = stamps[0];
  const last = stamps[stamps.length - 1];
  const span = last - first;
  const marks = stamps.map((t, i) => ({
    t,
    // A log that sits on one date still spreads out evenly instead of stacking on one point
    pct: span > 0 ? ((t - first) / span) * 100 : stamps.length > 1 ? (i / (stamps.length - 1)) * 100 : 0,
  }));
  return { marks, spanDays: Math.round(span / DAY_MS) };
}

/** The relapse log: Day 0 as a hollow ring, each relapse a tick, the latest one in white. */
function RelapseTimeline({ top, reduce }: { top: RelapseShow; reduce: boolean }) {
  const { marks, spanDays } = layoutMarks(top.timeline ?? []);
  if (marks.length < 2) return null;
  const first = marks[0].t;
  const last = marks[marks.length - 1].t;
  const sameYear = new Date(first).getUTCFullYear() === new Date(last).getUTCFullYear();
  const isMovie = top.kind === "movie";

  return (
    <>
      {/* Text equivalent of the log for screen readers */}
      <ol className="sr-only" aria-label={`${top.title} relapse log`}>
        {marks.map((m, i) => (
          <li key={`${m.t}-${i}`}>
            {i === 0
              ? `First watch: ${formatDay(m.t)}`
              : `${isMovie ? "Watch" : "Restart"} ${(isMovie ? i + 1 : i).toLocaleString()}: ${formatDay(m.t)}`}
          </li>
        ))}
      </ol>

      <div className="mt-8 short:mt-4 w-full max-w-sm px-3" aria-hidden="true">
        <div className="relative h-6">
          {/* The rail draws left to right, from Day 0 to the latest relapse */}
          <motion.div
            className="absolute inset-x-0 top-1/2 h-px origin-left"
            style={{ background: "var(--color-border-strong)" }}
            initial={reduce ? { opacity: 0 } : { scaleX: 0 }}
            animate={reduce ? { opacity: 1 } : { scaleX: 1 }}
            transition={{ delay: 0.5, duration: reduce ? 0.3 : 0.6, ease: EASE_SMOOTH }}
          />
          {marks.map((m, i) => {
            const isFirst = i === 0;
            const isLatest = i === marks.length - 1;
            // Each tick lands as the rail reaches it, so a 24-mark log takes no longer than a 2-mark one
            const delay = reduce ? 0.5 : 0.5 + (m.pct / 100) * 0.6;
            return (
              <span
                key={`${m.t}-${i}`}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${m.pct}%` }}
              >
                <motion.span
                  className="block"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay, duration: 0.25, ease: EASE_SMOOTH }}
                >
                  {isFirst ? (
                    <span
                      className="block w-3 h-3 rounded-full"
                      style={{ border: "2px solid var(--color-text-secondary)", background: "var(--color-bg)" }}
                    />
                  ) : (
                    <span
                      className="block w-0.5 rounded-full"
                      style={{
                        height: isLatest ? 20 : 14,
                        background: isLatest ? "var(--color-text)" : "var(--color-track-strong)",
                      }}
                    />
                  )}
                </motion.span>
              </span>
            );
          })}
        </div>

        <motion.div
          className="flex justify-between gap-4 mt-2 text-xs tabular-nums"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0.5 : 1.0, duration: 0.3, ease: EASE_SMOOTH }}
        >
          <span className="flex flex-col items-start text-left">
            <span className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              Day 0
            </span>
            <span style={{ color: "var(--color-muted)" }}>{endLabel(first, sameYear)}</span>
          </span>
          <span className="flex flex-col items-end text-right">
            <span className="font-semibold" style={{ color: "var(--color-text)" }}>
              Day {spanDays.toLocaleString()}
            </span>
            <span style={{ color: "var(--color-muted)" }}>{endLabel(last, sameYear)}</span>
          </span>
        </motion.div>
      </div>
    </>
  );
}

function runnerUpLine(r: RelapseShow): string {
  const n = `${r.restarts.toLocaleString()} ${timesWord(r.restarts)}`;
  return r.kind === "movie" ? `watched ${n}` : `restarted ${n}`;
}

export function SlideRelapse({ stats }: Props) {
  // MotionConfig reducedMotion="user" drops transforms only; reduced motion also skips the rail's
  // draw and the stagger, so everything arrives with a short opacity sequence.
  const reduce = useReducedMotion() === true;
  const relapses = relapsesOf(stats);
  const top = relapses[0];
  const runnersUp = relapses.slice(1, 3);

  if (!top) {
    // The reel skips this slide via hasRelapses; this only guards against a direct render.
    return (
      <div className="slide-container slide-stack items-center text-center px-6">
        <div className="relative flex flex-col items-center w-full max-w-md">
          <p className="text-xs font-semibold uppercase mb-4" style={kickerStyle}>
            Relapse tracker
          </p>
          <p className="text-title font-semibold max-w-xs" style={{ color: "var(--color-text)" }}>
            No relapses on record. Suspiciously well-adjusted.
          </p>
        </div>
      </div>
    );
  }

  const isMovie = top.kind === "movie";
  const count = top.restarts;
  const heroAria = `You've ${isMovie ? "watched" : "restarted"} ${top.title} ${count.toLocaleString()} ${timesWord(count)}`;

  return (
    <div className="slide-container slide-stack items-center text-center px-6">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--glow-hero)" }} aria-hidden="true" />

      <div className="relative flex flex-col items-center w-full max-w-md">
        <motion.p
          className="text-xs font-semibold uppercase mb-4"
          style={kickerStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: EASE_SMOOTH }}
        >
          Relapse tracker
        </motion.p>

        {/* The heading speaks the whole sentence; the visible label under it is aria-hidden */}
        <motion.div
          role="heading"
          aria-level={2}
          aria-label={heroAria}
          className="slide-hero font-black text-gradient-red tabular-nums"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: reduce ? 0.4 : 0.5, ease: reduce ? EASE_SMOOTH : EASE_SPRING }}
        >
          {count.toLocaleString()}
        </motion.div>

        {/* Reads on from the hero: "10" / "times you've started Friends over" */}
        <motion.p
          className="text-title font-semibold mt-2 max-w-sm break-words hyphens-auto"
          style={{ color: "var(--color-text-secondary)", textWrap: "balance" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4, ease: EASE_SMOOTH }}
          aria-hidden="true"
          data-testid="relapse-label"
        >
          {timesWord(count)} you&apos;ve {isMovie ? "watched" : "started"}{" "}
          <span style={{ color: "var(--color-text)" }}>{top.title}</span>
          {isMovie ? "" : " over"}
        </motion.p>

        <RelapseTimeline top={top} reduce={reduce} />

        {runnersUp.length > 0 && (
          <motion.ul
            className="mt-6 short:mt-3 w-full max-w-sm flex flex-col gap-1 text-sm"
            aria-label="Also relapsing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0.6 : 1.15, duration: 0.35, ease: EASE_SMOOTH }}
          >
            {runnersUp.map((r, i) => (
              <li
                key={`${r.title}-${i}`}
                // The second runner-up is overflow on short screens
                className={i === 1 ? "truncate short:hidden" : "truncate"}
                style={{ color: "var(--color-muted)" }}
              >
                <span style={{ color: "var(--color-text-secondary)" }}>{r.title}</span> {runnerUpLine(r)}
              </li>
            ))}
          </motion.ul>
        )}

        {/* The roast lands last, after the log finishes drawing */}
        <motion.p
          className="mt-8 short:mt-4 text-title font-semibold max-w-sm"
          style={{ color: "var(--color-text)", textWrap: "balance" }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0.7 : 1.35, duration: 0.45, ease: EASE_SMOOTH }}
        >
          {relapseQuip(top)}
        </motion.p>
      </div>
    </div>
  );
}
