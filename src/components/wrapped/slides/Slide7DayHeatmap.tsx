"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { DayHeatmap, WrappedStats } from "@/types";

interface Props {
  stats: Pick<WrappedStats, "dayHeatmap" | "hasTimeData" | "weeksSpanned" | "dayTitleCounts">;
}

const EASE_SMOOTH = [0.4, 0, 0.2, 1] as const;
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const kickerStyle = { letterSpacing: "0.1em", color: "var(--color-muted)" } as const;

/*
  Long heroes ("1,034", "~1,034h") overflow .slide-hero's 4.5rem floor at 320px, so they
  step down to a 3.5rem floor. The 15vh cap keeps short windows from overflowing.
*/
const LONG_HERO_FONT_SIZE = "clamp(3.5rem, 18vw, min(8rem, 15vh))";

const DAY_NAMES: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

/** One weekday's bar value: exact title count in date-only mode, hours otherwise. */
interface DayValue {
  day: DayHeatmap["day"];
  value: number;
}

/** Splits hours into a hero value and unit: 832.3 -> ["832", "h"], 1.4 -> ["1.4", "h"], 0.5 -> ["30", "m"]. */
function splitHours(hours: number): [string, "h" | "m"] {
  if (hours >= 10) return [Math.round(hours).toLocaleString(), "h"];
  if (hours >= 1) {
    return [hours.toLocaleString(undefined, { maximumFractionDigits: 1 }), "h"];
  }
  return [Math.max(1, Math.round(hours * 60)).toLocaleString(), "m"];
}

/** A visible "~" is announced as "tilde"; screen readers hear "about" instead. */
function Approx({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <>
      <span aria-hidden="true">~</span>
      <span className="sr-only">about </span>
    </>
  );
}

function HoursText({ hours, estimated }: { hours: number; estimated: boolean }) {
  const [value, unit] = splitHours(hours);
  return (
    <>
      <Approx show={estimated} />
      {value}
      {unit}
    </>
  );
}

/** Roasts the gap between the favorite weekday and the most neglected one. */
function weekQuip(peak: DayValue, days: DayValue[], countMode: boolean): string {
  const low = days.reduce((a, b) => (b.value < a.value ? b : a));
  const peakName = DAY_NAMES[peak.day] ?? peak.day;
  const lowName = DAY_NAMES[low.day] ?? low.day;
  if (low.value <= 0) return `You have never once watched on a ${lowName}. ${lowName} has questions.`;
  const ratio = peak.value / low.value;
  if (ratio >= 1.5) {
    const twice = ratio >= 1.95 && ratio < 2.05;
    const factor = twice ? "twice" : `${ratio.toLocaleString(undefined, { maximumFractionDigits: 1 })}x`;
    const amount = countMode ? `${factor} as many titles` : `${factor} as much screen time`;
    return `${peakName}s get ${amount} as ${lowName}s. ${lowName} knows it's not the favorite.`;
  }
  return "No day off, no favorite. Every day of the week is a Netflix day.";
}

export function Slide7DayHeatmap({ stats }: Props) {
  // Bar heights and delays are not transforms, so MotionConfig's reducedMotion skips them:
  // reduced motion renders the final chart outright.
  const reduce = useReducedMotion();
  const dayHeatmap = stats.dayHeatmap ?? [];
  const estimated = stats.hasTimeData !== true;

  // Date-only exports: per-weekday title counts are exact and hours are estimated, so counts
  // lead the slide. Stats stored before dayTitleCounts existed keep the hours view.
  const counts = stats.dayTitleCounts;
  const countMode = estimated && Array.isArray(counts) && counts.length > 0;
  const days: DayValue[] =
    countMode && counts
      ? counts.map((d) => ({ day: d.day, value: d.count }))
      : dayHeatmap.map((d) => ({ day: d.day, value: d.hours }));

  const maxValue = Math.max(...days.map((d) => d.value), 0);
  const hasData = days.length > 0 && maxValue > 0;
  const peakDay = hasData ? days.reduce((a, b) => (a.value > b.value ? a : b)) : null;
  const peakName = peakDay ? DAY_NAMES[peakDay.day] ?? peakDay.day : "";
  const peakHours = peakDay ? dayHeatmap.find((d) => d.day === peakDay.day)?.hours ?? 0 : 0;

  // dayHeatmap hours are all-time totals per weekday, which is the striking number, so it leads.
  // The weekly average is secondary; older stored stats lack weeksSpanned and skip it.
  const [hoursValue, hoursUnit] = splitHours(peakHours);
  const heroText = countMode ? (peakDay?.value ?? 0).toLocaleString() : hoursValue;
  // Visible characters: digits plus the "~" and unit for estimated hours.
  const heroLength = heroText.length + (countMode ? 0 : 1 + (estimated ? 1 : 0));
  const heroStyle = heroLength >= 5 ? { fontSize: LONG_HERO_FONT_SIZE } : undefined;
  const weeklyAverage =
    peakDay && stats.weeksSpanned != null ? peakHours / Math.max(1, stats.weeksSpanned) : null;
  const titleWord = peakDay?.value === 1 ? "title" : "titles";

  return (
    <div className="slide-container slide-stack items-center text-center px-6">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--glow-hero)" }} aria-hidden="true" />

      {peakDay ? (
        <div className="relative flex flex-col items-center w-full max-w-md">
          <motion.p
            className="text-xs font-semibold uppercase mb-4 break-words"
            style={kickerStyle}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_SMOOTH }}
          >
            You live for {peakName}s
          </motion.p>

          <motion.div
            role="heading"
            aria-level={2}
            className="slide-hero font-black text-gradient-red tabular-nums"
            style={heroStyle}
            // Rises out of its own baseline like the bars below it grow, instead of the spring pop
            // the other heroes use. Clip-path is not a transform, so reduced motion skips it.
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, clipPath: "inset(-10% -10% 100% -10%)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, clipPath: "inset(-10% -10% -10% -10%)" }}
            transition={{ delay: 0.15, duration: reduce ? 0.4 : 0.6, ease: reduce ? EASE_SMOOTH : EASE_OUT_EXPO }}
          >
            {countMode ? (
              heroText
            ) : (
              <>
                <Approx show={estimated} />
                {hoursValue}
                <span className="slide-hero-unit">{hoursUnit}</span>
              </>
            )}
          </motion.div>

          <motion.p
            className="text-title font-semibold mt-2"
            style={{ color: "var(--color-text-secondary)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4, ease: EASE_SMOOTH }}
          >
            {countMode ? `${titleWord} on ${peakName}s` : `of ${peakName}s, all-time`}
          </motion.p>

          {(weeklyAverage !== null || estimated) && (
            <motion.p
              className="text-xs mt-1 tabular-nums"
              style={{ color: "var(--color-muted)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4, ease: EASE_SMOOTH }}
            >
              {/* One short line: the "~" alone carries the hedge, never a second "estimated" */}
              {countMode ? (
                <>
                  <HoursText hours={peakHours} estimated /> all-time
                </>
              ) : weeklyAverage !== null ? (
                <>
                  <HoursText hours={weeklyAverage} estimated={estimated} /> on an average {peakName}
                </>
              ) : (
                "Hours estimated from title counts"
              )}
            </motion.p>
          )}

          {/* Text equivalent of the bars for screen readers */}
          <ul className="sr-only">
            {days.map((d) => (
              <li key={d.day}>
                {DAY_NAMES[d.day] ?? d.day}:{" "}
                {countMode
                  ? `${d.value.toLocaleString()} ${d.value === 1 ? "title" : "titles"} all-time`
                  : `${estimated ? "about " : ""}${d.value.toLocaleString(undefined, { maximumFractionDigits: 1 })} hours all-time`}
              </li>
            ))}
          </ul>

          {/* Supporting bars: neutral, peak a brighter neutral, so the hero stays the only red */}
          <div className="mt-8 short:mt-5 flex items-end gap-3 w-full max-w-sm h-32 short:h-20 px-2" aria-hidden="true">
            {days.map((d, i) => {
              const heightPct = Math.max((d.value / maxValue) * 100, 4);
              const isPeak = d.day === peakDay.day;

              return (
                <div key={d.day} className="flex-1 h-full flex flex-col items-center justify-end gap-2">
                  <motion.div
                    className="w-full rounded-t-lg"
                    style={{
                      background: isPeak ? "var(--color-track-strong)" : "var(--color-surface-2)",
                      border: `1px solid ${isPeak ? "transparent" : "var(--color-border)"}`,
                    }}
                    initial={reduce ? false : { height: "0%" }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ delay: 0.55 + i * 0.06, duration: 0.5, ease: EASE_SMOOTH }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: isPeak ? "var(--color-text)" : "var(--color-muted)" }}
                  >
                    {d.day}
                  </span>
                </div>
              );
            })}
          </div>

          {/* The roast lands under the chart, after the bars finish growing */}
          <motion.p
            className="mt-8 short:mt-5 text-title font-semibold max-w-sm"
            style={{ color: "var(--color-text)", textWrap: "balance" }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0.6 : 1.2, duration: 0.45, ease: EASE_SMOOTH }}
          >
            {weekQuip(peakDay, days, countMode)}
          </motion.p>
        </div>
      ) : (
        <>
          <motion.p
            className="relative text-xs font-semibold uppercase mb-4"
            style={kickerStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE_SMOOTH }}
          >
            Your weekly rhythm
          </motion.p>
          <motion.p
            className="relative text-title font-semibold max-w-xs"
            style={{ color: "var(--color-text)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: EASE_SMOOTH }}
          >
            No weekly rhythm to report. Every day is a mystery.
          </motion.p>
        </>
      )}
    </div>
  );
}
