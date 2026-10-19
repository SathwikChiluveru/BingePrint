"use client";

import { motion } from "framer-motion";
import type { WrappedStats } from "@/types";
import { toValidDate } from "@/lib/csv/stats";
import { HeroGlow } from "./HeroGlow";

interface Props {
  stats: Pick<WrappedStats, "longestBinge" | "hasTimeData">;
}

const EASE_SMOOTH = [0.4, 0, 0.2, 1] as const;
const EASE_SPRING = [0.34, 1.56, 0.64, 1] as const;

const kickerStyle = { letterSpacing: "0.1em", color: "var(--color-muted)" } as const;

/** "~" is read aloud as "tilde"; screen readers get "about" instead. */
function Approx() {
  return (
    <>
      <span aria-hidden="true">~</span>
      <span className="sr-only">about </span>
    </>
  );
}

/** Builds the roast from the record day itself: its date plus how many titles or hours it held. */
function bingeQuip(opts: {
  date: Date | null;
  estimated: boolean;
  titleCount: number;
  hours: number;
  wholeHours: number;
}): string {
  const { date, estimated, titleCount, hours, wholeHours } = opts;
  const day = date
    ? `${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}. `
    : "";
  const oneMore =
    titleCount >= 2 ? `"Just one more," said ${(titleCount - 1).toLocaleString()} times in a row.` : null;

  if (estimated) {
    // Date-only counts include whatever autoplay rolled into, so the line owns that instead of
    // pretending every title was a choice (the product is named after it).
    if (titleCount >= 12) return `${day}Autoplay did some of that. You never once reached for the remote.`;
    if (titleCount >= 6 && oneMore) return `${day}${oneMore}`;
    return `${day}${titleCount.toLocaleString()} ${titleCount === 1 ? "title" : "titles"}. By binge standards, a light snack.`;
  }
  if (hours >= 8) return `${day}${wholeHours.toLocaleString()} hours and the remote never left your hand.`;
  if (hours >= 5) return `${day}${oneMore ?? "Five-plus hours on one title. Did you fall asleep on the couch?"}`;
  return `${day}By binge standards, a light snack.`;
}

export function Slide5BingeBeast({ stats }: Props) {
  const { longestBinge } = stats;
  // Without time-of-day data, binges are grouped per calendar day and durations are estimated.
  const estimated = stats.hasTimeData !== true;
  const titles = longestBinge?.titles ?? [];
  const totalSeconds = longestBinge?.totalSeconds ?? 0;
  const hours = Math.round(totalSeconds / 3600);
  const totalMins = Math.round(totalSeconds / 60);
  const wholeHours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  // Exact title count; old stored stats lack titleCount, so fall back to distinct shows.
  const titleCount = longestBinge?.titleCount ?? longestBinge?.showCount ?? titles.length;
  const hasBinge = totalSeconds > 0 && titleCount > 0;
  // startTime is a string once stats round-trip through localStorage or the API.
  const date = toValidDate(longestBinge?.startTime);

  // Date-only: lead with the exact count, hours are a secondary estimate.
  // A single calendar day cannot hold more than 24h, so drop the estimate if it overshoots.
  const estimateLine =
    estimated && hours <= 24 ? (
      <>
        <Approx />
        {hours > 0 ? `${hours.toLocaleString()}h` : `${totalMins.toLocaleString()}m`} of watching
      </>
    ) : null;

  // Units step down (.slide-hero-unit) so "10h 45m" fits a 320px screen at hero size.
  const hero = estimated ? (
    titleCount.toLocaleString()
  ) : (
    <>
      {wholeHours.toLocaleString()}
      <span className="slide-hero-unit">h</span>
      {mins > 0 && (
        <>
          {" "}
          {mins}
          <span className="slide-hero-unit">m</span>
        </>
      )}
    </>
  );
  const heroAria = estimated
    ? undefined
    : `${wholeHours.toLocaleString()} ${wholeHours === 1 ? "hour" : "hours"}${mins > 0 ? ` ${mins} ${mins === 1 ? "minute" : "minutes"}` : ""}`;
  // Date-only data has no sittings, so a "binge" is one calendar day (defined in a visible note under the label).
  const heroLabel = estimated ? `${titleCount === 1 ? "title" : "titles"} in one day` : "straight";

  const quip = bingeQuip({ date, estimated, titleCount, hours, wholeHours });
  // One muted footnote: what was on, and nothing else.
  const footnote =
    titles.length > 0
      ? `Watching ${titles.slice(0, 2).join(", ")}${titles.length > 2 ? ` +${(titles.length - 2).toLocaleString()} more` : ""}`
      : "";

  return (
    <div className="slide-container slide-stack items-center px-6">
      {/* Left-aligned record: hero on top, the roast lands at the bottom */}
      <div className="relative flex flex-col items-start text-left w-full max-w-md">
        <motion.p
          className="text-xs font-semibold uppercase mb-4"
          style={kickerStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: EASE_SMOOTH }}
        >
          Binge beast record
        </motion.p>

        {hasBinge ? (
          <>
            {/* Glow sits on the hero itself, not the slide center, since the column is left-aligned */}
            <div className="relative mb-2">
              <HeroGlow />
              <motion.div
                className="relative slide-hero font-black text-gradient-red tabular-nums origin-left"
                aria-label={heroAria}
                role="heading"
                aria-level={2}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.5, ease: EASE_SPRING }}
              >
                {hero}
              </motion.div>
            </div>

            <motion.p
              className="text-title font-semibold"
              style={{ color: "var(--color-text-secondary)" }}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.4, ease: EASE_SMOOTH }}
            >
              {heroLabel}
            </motion.p>

            {(estimateLine || estimated) && (
              <motion.p
                className="text-sm mt-1 max-w-sm"
                style={{ color: "var(--color-muted)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.4, ease: EASE_SMOOTH }}
              >
                {estimateLine}
                {/* Date-only data has no sittings, so the definition is shown, not hidden. */}
                {estimated && (
                  <span className="block text-xs mt-0.5">
                    Your file has dates only, so a binge counts one calendar day.
                  </span>
                )}
              </motion.p>
            )}

            <motion.p
              className="mt-8 short:mt-5 text-title font-semibold max-w-sm"
              style={{ color: "var(--color-text)", textWrap: "balance" }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8, duration: 0.45, ease: EASE_SMOOTH }}
            >
              {quip}
            </motion.p>

            {footnote && (
              <motion.p
                className="mt-3 text-xs max-w-sm break-words"
                style={{ color: "var(--color-muted)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.05, duration: 0.4, ease: EASE_SMOOTH }}
              >
                {footnote}
              </motion.p>
            )}
          </>
        ) : (
          <motion.p
            className="text-title font-semibold max-w-xs"
            style={{ color: "var(--color-text)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4, ease: EASE_SMOOTH }}
          >
            No marathon sessions yet. Your self-control is suspicious.
          </motion.p>
        )}
      </div>
    </div>
  );
}
