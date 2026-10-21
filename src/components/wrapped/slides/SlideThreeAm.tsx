"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FullExportSteps } from "@/components/wrapped/FullExportSteps";
import type { DayHeatmap, HourHeatmap, WrappedStats } from "@/types";

type Stats = Pick<WrappedStats, "insights" | "hasTimeData">;

const EASE = [0.4, 0, 0.2, 1] as const;
const SPRING = [0.34, 1.56, 0.64, 1] as const;

const kickerStyle = { letterSpacing: "0.1em", color: "var(--color-muted)" } as const;

/** Same step-down as Your week's long hero, for the rare 5+ character value ("1,204h"). */
const LONG_HERO_FONT_SIZE = "clamp(3.5rem, 18vw, min(8rem, 15vh))";

const DAYS: DayHeatmap["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Two letters, not three: "Mon" costs ~8px of cell width at 320px, and one letter repeats T and S.
const ROW_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const DAY_NAMES: Record<DayHeatmap["day"], string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};
const AXIS_HOURS = [0, 6, 12, 18];
const THREE_AM = 3;

/*
  Sequential single-hue ramp (white over Screening Room), never red: the hero owns the frame's red.
  Empty cells are the bare track; the peak is full white. Steps are sqrt-scaled so one huge cell
  doesn't flatten the rest of the week into the first step.
*/
const RAMP = ["rgba(255, 255, 255, 0.13)", "rgba(255, 255, 255, 0.24)", "rgba(255, 255, 255, 0.38)", "var(--color-track-strong)"];
const PEAK_FILL = "var(--color-text)";

/*
  Cell sizing (CSS grid: a label column, then 24 x minmax(0, 1fr), 2px gaps, square cells).
  The grid bleeds 8px into each side of the 24px slide padding, and the 2-letter labels take ~16px:
    320px: 320 - 32 = 288 - 18 (label + gap) = 270 - 46 (23 gaps) = 224 / 24 = ~9.3px
    375px: 343 - 18 - 46 = 279 / 24 = ~11.6px
    390px: 358 - 18 - 46 = 294 / 24 = ~12.3px
  Desktop caps the grid at 28rem: 448 - 18 - 46 = 384 / 24 = 16px.
*/

function formatHour(h: number) {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  return h > 12 ? `${h - 12}pm` : `${h}am`;
}

function axisLabel(h: number) {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return formatHour(h);
}

/** "41 hours", "2.5 hours", "45 minutes" (exact figures may keep one decimal). */
function durationPhrase(minutes: number) {
  const hours = minutes / 60;
  if (hours >= 10) {
    const n = Math.round(hours);
    return `${n.toLocaleString()} ${n === 1 ? "hour" : "hours"}`;
  }
  if (hours >= 1) {
    const n = Math.round(hours * 10) / 10;
    return `${n.toLocaleString()} ${n === 1 ? "hour" : "hours"}`;
  }
  const m = Math.max(1, Math.round(minutes));
  return `${m} ${m === 1 ? "minute" : "minutes"}`;
}

interface Report {
  cells: number[][];
  max: number;
  peakDay: DayHeatmap["day"];
  peakHour: number;
  share: number; // 0-100, as stored
  threeAmMinutes: number;
}

/** The usable heatmap, or null when the slide must show its locked state. */
function readReport(stats: Stats): Report | null {
  if (stats.hasTimeData !== true) return null;
  const h: HourHeatmap | null | undefined = stats.insights?.hourHeatmap;
  if (!h || !Array.isArray(h.cells)) return null;

  // Stored stats can be partial or hand-edited: coerce to a clean 7 x 24 grid of minutes.
  const cells = DAYS.map((_, d) =>
    Array.from({ length: 24 }, (_, hr) => {
      const v = Number(h.cells[d]?.[hr]);
      return Number.isFinite(v) && v > 0 ? v : 0;
    }),
  );
  const max = Math.max(0, ...cells.flat());
  if (max <= 0) return null;

  // Prefer the engine's peak; fall back to the grid's own argmax when it is missing or invalid.
  let peakDay = DAYS.includes(h.peakDay) ? h.peakDay : null;
  let peakHour = Number.isInteger(h.peakHour) && h.peakHour >= 0 && h.peakHour <= 23 ? h.peakHour : null;
  if (peakDay === null || peakHour === null || cells[DAYS.indexOf(peakDay)][peakHour] <= 0) {
    let best = -1;
    cells.forEach((row, d) =>
      row.forEach((v, hr) => {
        if (v > best) {
          best = v;
          peakDay = DAYS[d];
          peakHour = hr;
        }
      }),
    );
  }

  const share = Number(h.lateNightShare);
  const threeAm = Number(h.threeAmMinutes);
  return {
    cells,
    max,
    peakDay: peakDay as DayHeatmap["day"],
    peakHour: peakHour as number,
    share: Number.isFinite(share) ? Math.max(0, Math.min(100, share)) : 0,
    threeAmMinutes: Number.isFinite(threeAm) && threeAm > 0 ? threeAm : 0,
  };
}

type Hero =
  | { kind: "share"; text: string; spoken: string }
  | { kind: "hours"; text: string; spoken: string };

/*
  Hero selection. Both figures are exact, so the pick is about which lands harder:
    1. A late-night share of 20%+ is the confession: lead with it.
    2. Otherwise 10+ hours in the 3am hour is the bigger-sounding receipt: lead with the hours.
    3. Otherwise the share, however small (including "<1%" and "0%"), so the hero never inflates.
*/
function pickHero(r: Report): Hero {
  const hours = r.threeAmMinutes / 60;
  if (r.share < 20 && hours >= 10) {
    const n = Math.round(hours);
    return { kind: "hours", text: n.toLocaleString(), spoken: `${durationPhrase(r.threeAmMinutes)} in the 3am hour` };
  }
  const rounded = Math.round(r.share);
  const text = rounded === 0 && r.share > 0 ? "<1" : String(rounded);
  const spoken = `${text === "<1" ? "under 1" : text}% of your watching starts between midnight and 5am`;
  return { kind: "share", text, spoken };
}

/** One roast built on the viewer's own busiest hour. Habits only. */
function roast(r: Report): string {
  const day = DAY_NAMES[r.peakDay];
  const when = `${day} at ${formatHour(r.peakHour)}`;
  const h = r.peakHour;
  if (h >= 0 && h <= 4) return `Your peak is ${when}. ${when} is not a time, it's a confession.`;
  if (h <= 8) return `Your peak is ${when}. Watching before breakfast is a choice, and you keep making it.`;
  if (h <= 16) return `Your peak is ${when}. Bold of you to watch during business hours.`;
  if (h <= 21) {
    return r.threeAmMinutes > 0
      ? `Your peak is ${when}. Prime time, like a normal person. The 3am column says otherwise.`
      : `Your peak is ${when}. Prime time, never a 3am. Suspiciously well rested.`;
  }
  return `Your peak is ${when}. "One more episode" has never once meant one.`;
}

/** The three busiest day-hour cells, for the text equivalent of the grid. */
function busiest(r: Report) {
  return r.cells
    .flatMap((row, d) => row.map((minutes, hour) => ({ day: DAYS[d], hour, minutes })))
    .filter((c) => c.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 3);
}

/** Live-region summary for SlideShow ("The 3am Report: {this}, slide N of M"). */
export function threeAmSummary(stats: Stats): string {
  const r = readReport(stats);
  if (!r) return "locked, needs the full data request";
  return pickHero(r).spoken;
}

function fill(minutes: number, max: number, isPeak: boolean) {
  if (minutes <= 0) return "var(--color-track)";
  if (isPeak) return PEAK_FILL;
  const step = Math.min(RAMP.length - 1, Math.floor(Math.sqrt(minutes / max) * RAMP.length));
  return RAMP[step];
}

interface GridProps {
  cells: number[][];
  max: number;
  peak: { day: number; hour: number } | null;
  animate: boolean;
}

/** The 7 x 24 grid with the 3am column outlined and labelled. Purely visual: always aria-hidden. */
function HourGrid({ cells, max, peak, animate }: GridProps) {
  return (
    <div
      aria-hidden="true"
      className="grid w-full"
      style={{ gridTemplateColumns: "auto repeat(24, minmax(0, 1fr))", columnGap: 2, rowGap: 2 }}
    >
      {/* Row 1: the "3am" marker over its column */}
      <span
        className="text-xs font-semibold flex justify-center whitespace-nowrap mb-0.5"
        style={{ gridColumn: THREE_AM + 2, gridRow: 1, color: "var(--color-text-secondary)" }}
      >
        3am
      </span>

      {ROW_LABELS.map((label, d) => (
        <span
          key={label}
          className="text-xs font-medium text-left pr-0.5 leading-none flex items-center"
          style={{
            gridColumn: 1,
            gridRow: d + 2,
            color: peak?.day === d ? "var(--color-text)" : "var(--color-muted)",
          }}
        >
          {label}
        </span>
      ))}

      {cells.map((row, d) =>
        row.map((minutes, hour) => {
          const isPeak = peak?.day === d && peak.hour === hour;
          return (
            <motion.span
              key={`${d}-${hour}`}
              className="block aspect-square"
              style={{
                gridColumn: hour + 2,
                gridRow: d + 2,
                borderRadius: 2,
                background: fill(minutes, max, isPeak),
              }}
              // Sweeps in hour by hour, like the night going by. Reduced motion: in place.
              initial={animate ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={animate ? { delay: 0.5 + hour * 0.02 + d * 0.01, duration: 0.3, ease: EASE } : { duration: 0 }}
            />
          );
        }),
      )}

      {/* The 3am column outline sits over its cells, 1px outside them */}
      <span
        className="pointer-events-none"
        style={{
          gridColumn: THREE_AM + 2,
          gridRow: "2 / span 7",
          margin: -2,
          borderRadius: 4,
          border: "1px solid var(--color-border-strong)",
        }}
      />

      {/* Hour axis: 12am, 6am, 12pm, 6pm, each starting at its own column */}
      {AXIS_HOURS.map((h) => (
        <span
          key={h}
          className="text-xs text-left whitespace-nowrap mt-1"
          style={{ gridColumn: `${h + 2} / span 6`, gridRow: 9, color: "var(--color-muted)" }}
        >
          {axisLabel(h)}
        </span>
      ))}
    </div>
  );
}

/** Deterministic made-up week for the locked teaser: evenings, a weekend lean, a few late nights. */
const SAMPLE_CELLS: number[][] = DAYS.map((_, d) =>
  Array.from({ length: 24 }, (_, h) => {
    const weekend = d >= 4 ? 1.6 : 1;
    const evening = Math.max(0, 1 - Math.abs(h - 21) / 4);
    const late = h <= 3 ? (d >= 4 ? 0.7 - h * 0.15 : 0.25 - h * 0.08) : 0;
    const lunch = h === 12 || h === 13 ? 0.15 : 0;
    return Math.max(0, Math.round((evening + late + lunch) * weekend * 60));
  }),
);
const SAMPLE_MAX = Math.max(...SAMPLE_CELLS.flat());

function LockedReport() {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex flex-col items-center w-full max-w-md">
      <motion.p
        className="text-xs font-semibold uppercase mb-4 short:mb-3"
        style={kickerStyle}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        The 3am Report
      </motion.p>

      {/* Ghosted sample: shows the shape of the report without pretending it is the viewer's.
          Hidden on short screens, where the steps need the room. */}
      <motion.div
        aria-hidden="true"
        className="relative self-stretch -mx-2 short:hidden"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
      >
        <div style={{ opacity: 0.45, filter: "blur(1.5px)" }}>
          <HourGrid cells={SAMPLE_CELLS} max={SAMPLE_MAX} peak={null} animate={false} />
        </div>
        <span
          className="absolute top-0 right-2 text-xs font-semibold uppercase px-2 py-0.5 rounded-md"
          style={{
            ...kickerStyle,
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
          }}
        >
          Sample
        </span>
      </motion.div>

      <motion.h2
        className="mt-6 short:mt-0 text-title font-semibold max-w-sm"
        style={{ color: "var(--color-text)", textWrap: "balance" }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.4, ease: EASE }}
      >
        Your file has dates, not times. The 3am Report needs the full data request.
      </motion.h2>

      <motion.div
        className="mt-5 short:mt-3 w-full max-w-sm"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4, ease: EASE }}
      >
        <FullExportSteps />
      </motion.div>
    </div>
  );
}

export function SlideThreeAm({ stats }: { stats: Stats }) {
  // Opacity delays are not transforms, so MotionConfig's reducedMotion would still play them:
  // reduced motion renders the final grid outright.
  const reduce = useReducedMotion();
  const report = readReport(stats);

  if (!report) {
    return (
      <div className="slide-container slide-stack items-center text-center px-6">
        <LockedReport />
      </div>
    );
  }

  const hero = pickHero(report);
  const heroLength = hero.text.length + 1; // digits plus the unit
  const peakDayIndex = DAYS.indexOf(report.peakDay);
  const top = busiest(report);
  const shareText = Math.round(report.share) === 0 && report.share > 0 ? "under 1" : String(Math.round(report.share));

  return (
    <div className="slide-container slide-stack items-center text-center px-6">
      <div className="relative flex flex-col items-center w-full max-w-md">
        <motion.p
          className="text-xs font-semibold uppercase mb-4 short:mb-2"
          style={kickerStyle}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: EASE }}
        >
          The 3am Report
        </motion.p>

        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute -inset-16 pointer-events-none"
            style={{ background: "var(--glow-hero)" }}
          />
          <motion.div
            role="heading"
            aria-level={2}
            className="relative slide-hero font-black text-gradient-red tabular-nums"
            style={heroLength >= 5 ? { fontSize: LONG_HERO_FONT_SIZE } : undefined}
            initial={reduce ? false : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? { duration: 0 } : { delay: 0.2, duration: 0.5, ease: SPRING }}
          >
            {hero.text === "<1" ? (
              <>
                <span aria-hidden="true">&lt;1</span>
                <span className="sr-only">under 1</span>
              </>
            ) : (
              hero.text
            )}
            <span className="slide-hero-unit">{hero.kind === "share" ? "%" : "h"}</span>
          </motion.div>
        </div>

        <motion.p
          className="text-base mt-1"
          style={{ color: "var(--color-text-secondary)", textWrap: "balance" }}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4, ease: EASE }}
        >
          {hero.kind === "share"
            ? "of your watching starts between midnight and 5am"
            : "spent in the 3am hour, all-time"}
        </motion.p>

        {/* Text equivalent of the grid */}
        <div className="sr-only">
          <p>
            Busiest hour: {DAY_NAMES[report.peakDay]}s at {formatHour(report.peakHour)}. {shareText}% of your watching
            starts between midnight and 5am. {durationPhrase(report.threeAmMinutes)} in the 3am hour, all-time.
          </p>
          <p>Your three busiest times:</p>
          <ol>
            {top.map((c) => (
              <li key={`${c.day}-${c.hour}`}>
                {DAY_NAMES[c.day]} at {formatHour(c.hour)}: {durationPhrase(c.minutes)}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 short:mt-4 self-stretch -mx-2">
          <HourGrid
            cells={report.cells}
            max={report.max}
            peak={{ day: peakDayIndex, hour: report.peakHour }}
            animate={!reduce}
          />
          {/* Ramp key: brighter means more minutes. Nonessential on short screens. */}
          <div
            aria-hidden="true"
            className="short:hidden mt-2 flex items-center justify-end gap-1 text-xs"
            style={{ color: "var(--color-muted)" }}
          >
            <span className="mr-1">Less</span>
            {["var(--color-track)", ...RAMP, PEAK_FILL].map((c) => (
              <span key={c} className="block w-2.5 h-2.5" style={{ background: c, borderRadius: 2 }} />
            ))}
            <span className="ml-1">More</span>
          </div>
        </div>

        {/* The roast names the peak cell, the brightest square above */}
        <motion.p
          className="mt-6 short:mt-4 text-title font-semibold max-w-sm"
          style={{ color: "var(--color-text)", textWrap: "balance" }}
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0.3 : 1.1, duration: 0.45, ease: EASE }}
        >
          {roast(report)}
        </motion.p>
      </div>
    </div>
  );
}
