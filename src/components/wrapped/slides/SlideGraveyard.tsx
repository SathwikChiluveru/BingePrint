"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { GraveyardShow, WrappedStats } from "@/types";
import { HeroGlow } from "./HeroGlow";

type GraveyardStats = Pick<WrappedStats, "insights">;

interface Props {
  stats: GraveyardStats;
}

const SMOOTH: [number, number, number, number] = [0.4, 0, 0.2, 1];
const OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Epitaph rows on screen: four on phones and desktop, three on short screens (the 4th hides). */
const MAX_ROWS = 4;
/** Titles longer than this are shortened inside the roast line (the rows clamp on their own). */
const ROAST_TITLE_MAX = 28;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NUMBER_WORDS = ["Zero", "One", "Two", "Three"];

/** The buried shows, newest burial first, with bad rows (no title) dropped. Never throws. */
function burials(stats: GraveyardStats): GraveyardShow[] {
  const list = stats?.insights?.graveyard;
  if (!Array.isArray(list)) return [];
  return list.filter((s) => s && typeof s.title === "string" && s.title.trim() !== "");
}

/** All buried shows, before the engine's 12-row cap; never less than the rows we have. */
function buriedCount(stats: GraveyardStats): number {
  const n = Math.round(Number(stats?.insights?.graveyardCount) || 0);
  return Math.max(n, burials(stats).length);
}

export function hasGraveyard(stats: GraveyardStats): boolean {
  return burials(stats).length > 0 && buriedCount(stats) > 0;
}

/** "23 shows quit by episode 3" for the reel's live region; empty string when nothing is buried. */
export function graveyardSummary(stats: GraveyardStats): string {
  if (!hasGraveyard(stats)) return "";
  const n = buriedCount(stats);
  return `${n.toLocaleString()} ${n === 1 ? "show" : "shows"} quit by episode 3`;
}

/** "2023-03-14" to "Mar 2023", parsed by hand so no timezone can shift the month. */
export function deathDate(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : null;
}

function episodesLabel(n: number): string {
  const eps = Math.max(1, Math.round(Number(n) || 1));
  return `${eps.toLocaleString()} ${eps === 1 ? "episode" : "episodes"}`;
}

/** Cuts a long title at a word boundary so the roast line stays one idea, not a paragraph. */
function shortTitle(title: string): string {
  const t = title.trim();
  if (t.length <= ROAST_TITLE_MAX) return t;
  const cut = t.slice(0, ROAST_TITLE_MAX);
  const space = cut.lastIndexOf(" ");
  return `${(space > 12 ? cut.slice(0, space) : cut).replace(/[\s:,.\-–—]+$/, "")}…`;
}

/** One roast, about the most recent burial. Teases the habit (quitting), never the person. */
export function graveyardQuip(latest: GraveyardShow, count: number): string {
  const title = shortTitle(latest.title);
  const eps = Math.max(1, Math.round(Number(latest.episodesWatched) || 1));
  if (count === 1) {
    return eps === 1
      ? `Just one grave. ${title} got a single episode and your silence.`
      : `Just one grave. ${title} made it ${eps} episodes, then nothing.`;
  }
  if (eps === 1) return `${title} got one episode. That was the audition, and it failed.`;
  if (eps === 2) return `Two episodes was all ${title} got. Not even a cliffhanger saved it.`;
  return `${NUMBER_WORDS[Math.min(eps, 3)]} episodes was all ${title} got. It had a plan.`;
}

export function SlideGraveyard({ stats }: Props) {
  const shows = burials(stats);
  const count = buriedCount(stats);
  const rows = shows.slice(0, MAX_ROWS);
  const more = count - rows.length;
  // MotionConfig reducedMotion="user" drops transforms only; clip-path still animates,
  // so reduced motion is an opacity-only path.
  const reduce = useReducedMotion();

  return (
    <div className="slide-container slide-stack items-center text-center px-6">
      {/*
        Centered and quiet: the hero settles down into place (the mirror of Your week's rise),
        then the epitaphs are set like inscriptions, one divided row each, all grayscale.
        The hero sits above the slide's center, so the glow is anchored to it (HeroGlow).
      */}
      <div className="relative flex flex-col items-center w-full max-w-sm">
        <motion.p
          className="text-xs font-semibold uppercase mb-4 short:mb-2"
          style={{ color: "var(--color-muted)", letterSpacing: "0.1em" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: SMOOTH }}
        >
          Here lies
        </motion.p>

        {shows.length === 0 ? (
          <>
            <motion.h2
              className="text-display font-black"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5, ease: SMOOTH }}
            >
              Nobody
            </motion.h2>
            <motion.p
              className="mt-6 text-title font-semibold max-w-sm"
              style={{ color: "var(--color-text)", textWrap: "balance" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.3, ease: SMOOTH }}
            >
              You finish what you start. Suspicious, honestly.
            </motion.p>
          </>
        ) : (
          <>
            <div className="relative">
              <HeroGlow />
              {/* Lowered into place: drops a little and unclips top-down, slow out-expo, no overshoot */}
              <motion.div
                role="heading"
                aria-level={2}
                className="relative slide-hero font-black text-gradient-red tabular-nums"
                initial={
                  reduce ? { opacity: 0 } : { opacity: 0, y: -28, clipPath: "inset(-10% -10% 100% -10%)" }
                }
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, clipPath: "inset(-10% -10% -10% -10%)" }}
                transition={{ delay: 0.2, duration: reduce ? 0.4 : 0.8, ease: reduce ? SMOOTH : OUT_EXPO }}
              >
                {count.toLocaleString()}
              </motion.div>
            </div>
            <motion.p
              className="text-base mt-1"
              style={{ color: "var(--color-text-secondary)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.3, ease: SMOOTH }}
            >
              {count === 1 ? "show you quit by episode 3" : "shows you quit by episode 3"}
            </motion.p>

            <ol
              aria-label="Most recent burials"
              className="w-full mt-6 short:mt-3"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              {rows.map((show, i) => {
                const date = deathDate(show.lastWatched);
                return (
                  <motion.li
                    key={`${show.title}-${i}`}
                    className={`py-2.5 short:py-1.5 ${i >= 3 ? "short:hidden" : ""}`}
                    style={{ borderBottom: "1px solid var(--color-border)" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 + i * 0.12, duration: 0.4, ease: SMOOTH }}
                  >
                    {/* Two lines, then an ellipsis: long titles stay readable without a tooltip */}
                    <p
                      className="line-clamp-2 break-words text-base short:text-sm font-semibold leading-snug"
                      style={{ color: "var(--color-text)" }}
                    >
                      {show.title}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums" style={{ color: "var(--color-muted)" }}>
                      {episodesLabel(show.episodesWatched)}
                      {date && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="sr-only">, last watched </span>
                          <time dateTime={show.lastWatched}>{date}</time>
                        </>
                      )}
                    </p>
                  </motion.li>
                );
              })}
            </ol>

            {more > 0 && (
              <motion.p
                className="mt-2 text-xs tabular-nums short:hidden"
                style={{ color: "var(--color-muted)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 + rows.length * 0.12, duration: 0.3, ease: SMOOTH }}
              >
                and {more.toLocaleString()} more, never visited
              </motion.p>
            )}

            <motion.p
              className="mt-6 short:mt-3 text-title short:text-base font-semibold max-w-sm"
              style={{ color: "var(--color-text)", textWrap: "balance" }}
              initial={reduce ? false : { opacity: 0, filter: "blur(6px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ delay: 1.3, duration: 0.5, ease: SMOOTH }}
            >
              {graveyardQuip(shows[0], count)}
            </motion.p>
          </>
        )}
      </div>
    </div>
  );
}
