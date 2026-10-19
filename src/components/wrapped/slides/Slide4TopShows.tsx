"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ShowStat, WrappedStats } from "@/types";
import { isLikelyMovie } from "@/lib/csv/stats";
import { HeroGlow } from "./HeroGlow";

interface Props {
  stats: Pick<WrappedStats, "topShows" | "hasTimeData" | "uniqueShowsCount" | "totalEpisodesEstimate">;
}

const SMOOTH: [number, number, number, number] = [0.4, 0, 0.2, 1];
const SPRING: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

/** "~" is read aloud as "tilde"; screen readers get "about" instead. */
function Approx() {
  return (
    <>
      <span aria-hidden="true">~</span>
      <span className="sr-only">about </span>
    </>
  );
}

/** Hours for a list row. Under an hour already reads as a hedge, so it skips the "~". */
function Hours({ totalSeconds, estimated }: { totalSeconds: number; estimated: boolean }) {
  const hours = Math.round(totalSeconds / 3600);
  if (hours < 1) return <>under 1h</>;
  return (
    <>
      {estimated && <Approx />}
      {hours.toLocaleString()}h
    </>
  );
}

/** Share of every title watched that went to the top list (0 when it cannot be computed). */
function topShowsShare(shows: ShowStat[], totalTitles: number): number {
  if (totalTitles <= 0) return 0;
  const watched = shows.reduce((s, x) => s + x.watchCount, 0);
  return Math.min(100, Math.round((watched / totalTitles) * 100));
}

/**
 * Sets the top list against how many titles got a try. uniqueShowsCount counts movies as well as
 * shows, so the copy says "titles". The share itself is the hero, so it is not repeated.
 */
function topShowsQuip(n: number, uniqueTitles: number): string {
  if (uniqueTitles <= n) {
    return `Only ${uniqueTitles.toLocaleString()} ${uniqueTitles === 1 ? "title" : "titles"} entered. Not much of a contest.`;
  }
  return `${uniqueTitles.toLocaleString()} titles tried. ${n === 1 ? "This is the one" : `These ${n} are the ones`} you couldn't quit.`;
}

export function Slide4TopShows({ stats }: Props) {
  const estimated = stats.hasTimeData !== true;
  const shows = (stats.topShows ?? []).slice(0, 5);
  const first = shows[0];
  // Bars use the metric the list is ranked by: exact plays for date-only exports (their hours are
  // estimates), watch time otherwise. Max over the list, not just #1, in case old stats rank differently.
  const barValue = (s: ShowStat) => (estimated ? s.watchCount : s.totalSeconds) || 0;
  const max = Math.max(...shows.map(barValue), 1);
  const share = topShowsShare(shows, stats.totalEpisodesEstimate ?? 0);
  // MotionConfig reducedMotion="user" only drops transforms; render bars at their final
  // width outright so nothing grows under reduced motion.
  const reduce = useReducedMotion();

  return (
    <div className="slide-container slide-stack items-center px-6">
      {/* Left-aligned ranking: reads like a leaderboard, breaks the centered-stack rhythm */}
      <div className="relative flex flex-col items-start text-left w-full max-w-sm">
        <motion.p
          className="text-xs font-semibold uppercase mb-3 short:mb-2"
          style={{ color: "var(--color-muted)", letterSpacing: "0.1em" }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.3, ease: SMOOTH }}
        >
          {shows.length > 1 ? `Hall of Fame: your top ${shows.length}` : "Hall of Fame"}
        </motion.p>

        {!first ? (
          <motion.p
            className="text-title font-semibold max-w-sm"
            style={{ color: "var(--color-text)", textWrap: "balance" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3, ease: SMOOTH }}
          >
            The Hall of Fame is empty. No show has earned a spot yet.
          </motion.p>
        ) : (
          <>
            {/*
              The hero is the list's grip on the whole history, not #1's episode
              count: slide 3 just showed that number.
            */}
            {share > 0 && (
              <>
                {/* Glow sits on the hero itself, not the slide center, since the column is left-aligned */}
                <div className="relative">
                  <HeroGlow />
                  <motion.div
                    className="relative slide-hero font-black text-gradient-red tabular-nums origin-left"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: SPRING }}
                  >
                    {share.toLocaleString()}
                    <span className="slide-hero-unit">%</span>
                  </motion.div>
                </div>
                <motion.p
                  className="text-base mt-1"
                  style={{ color: "var(--color-text-secondary)" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.3, ease: SMOOTH }}
                >
                  of everything you watched went to {shows.length === 1 ? "this one" : `these ${shows.length}`}
                </motion.p>
              </>
            )}

            {/* Rows tighten on short screens so the roast line below lands without scrolling at 375x548 */}
            <ol className={`w-full space-y-1.5 short:space-y-1 ${share > 0 ? "mt-5 short:mt-3" : ""}`}>
                {shows.map((show, i) => {
                  const pct = Math.min(100, Math.round((barValue(show) / max) * 100));
                  return (
                    <motion.li
                      key={`${show.title}-${i}`}
                      className="relative overflow-hidden rounded-lg px-3 py-2 short:py-1"
                      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.12, duration: 0.3, ease: SMOOTH }}
                    >
                      <div className="relative flex items-baseline gap-3">
                        <span
                          className="w-4 shrink-0 text-sm font-bold tabular-nums text-right"
                          style={{ color: "var(--color-muted)" }}
                        >
                          <span className="sr-only">Rank </span>
                          {i + 1}
                        </span>
                        {/* Two lines, then an ellipsis: long titles stay readable without a hover-only tooltip */}
                        <span className="flex-1 min-w-0 line-clamp-2 break-words text-sm font-semibold leading-snug">
                          {show.title}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums" style={{ color: "var(--color-muted)" }}>
                          <span style={{ color: "var(--color-text-secondary)" }}>
                            {show.watchCount === 1
                              ? "once"
                              : `${show.watchCount.toLocaleString()} ${isLikelyMovie(show) ? "watches" : "eps"}`}
                          </span>
                          {/* Count + bar carry the ranking; the hours drop on short screens to save a line */}
                          <span className="short:hidden">
                            {" · "}
                            <Hours totalSeconds={show.totalSeconds} estimated={estimated} />
                          </span>
                        </span>
                      </div>
                      {/*
                        Share of #1 by the ranking metric, as a thin bar under the title so the text
                        keeps full contrast. Neutral (strong track over track): the hero stays the only red.
                      */}
                      <div
                        aria-hidden="true"
                        className="mt-1.5 ml-7 h-1 overflow-hidden rounded-full short:mt-0.5"
                        style={{ background: "var(--color-track)" }}
                      >
                        <motion.div
                          className="h-full rounded-full origin-left"
                          style={{ background: "var(--color-track-strong)" }}
                          initial={reduce ? false : { scaleX: 0 }}
                          animate={{ scaleX: pct / 100 }}
                          transition={reduce ? { duration: 0 } : { delay: 0.65 + i * 0.12, duration: 0.6, ease: SMOOTH }}
                        />
                      </div>
                    </motion.li>
                  );
                })}
            </ol>

            <motion.p
              className="mt-5 short:mt-3 text-title short:text-base font-semibold"
              style={{ color: "var(--color-text)", textWrap: "balance" }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.15, duration: 0.4, ease: SMOOTH }}
            >
              {topShowsQuip(shows.length, stats.uniqueShowsCount ?? shows.length)}
            </motion.p>

            {estimated && (
              <motion.p
                // Hidden with the per-row hours it explains
                className="text-xs mt-2 short:hidden"
                style={{ color: "var(--color-muted)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.3, duration: 0.3, ease: SMOOTH }}
              >
                Hours estimated from title counts
              </motion.p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
