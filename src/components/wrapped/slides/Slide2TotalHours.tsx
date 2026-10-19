"use client";

import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { WrappedStats } from "@/types";
import { EMPTY_HISTORY_LINE } from "@/lib/csv/stats";

interface Props {
  stats: Pick<WrappedStats, "totalHours" | "funComparison" | "hasTimeData" | "totalEpisodesEstimate">;
}

const SPRING: [number, number, number, number] = [0.34, 1.56, 0.64, 1];
const SMOOTH: [number, number, number, number] = [0.4, 0, 0.2, 1];

/** Screen readers announce "~" as "tilde"; each one is spoken as "about" instead. */
function withSpokenApprox(text: string) {
  const parts = text.split("~");
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 && (
        <>
          <span aria-hidden="true">~</span>
          <span className="sr-only">about </span>
        </>
      )}
      {part}
    </Fragment>
  ));
}

export function Slide2TotalHours({ stats }: Props) {
  const reduce = useReducedMotion();
  // Date-only exports: the title count is exact, hours are estimated. Exact leads.
  const estimated = stats.hasTimeData !== true;
  const titles = stats.totalEpisodesEstimate ?? 0;
  const hours = stats.totalHours ?? 0;

  const heroValue = estimated ? titles : hours;
  const heroLabel = estimated
    ? titles === 1 ? "title watched" : "titles watched"
    : hours === 1 ? "hour watched" : "hours watched";

  // New stats open the comparison with "~N hours" for estimates. Stats stored before that
  // change lack it, so the estimate lead is added here: one "~", one note, no repeats.
  // An empty history gets the empty-state line, never "~0 hours" (old stored stats included).
  const empty = titles <= 0 && hours <= 0;
  const comparison = stats.funComparison ?? "";
  const punchline = empty
    ? EMPTY_HISTORY_LINE
    : estimated && !comparison.startsWith("~")
      ? `~${hours.toLocaleString()} ${hours === 1 ? "hour" : "hours"}. ${comparison}`
      : comparison;

  return (
    <div className="slide-container slide-stack items-center text-center px-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: "var(--glow-hero)" }}
      />

      <div className="relative flex flex-col items-center w-full max-w-md">
        <motion.p
          className="text-xs font-semibold uppercase mb-4"
          style={{ color: "var(--color-muted)", letterSpacing: "0.1em" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3, ease: SMOOTH }}
        >
          {estimated ? "Every title, on the record" : "Time you’ll never get back"}
        </motion.p>

        <motion.div
          role="heading"
          aria-level={2}
          className="slide-hero font-black mb-2 text-gradient-red tabular-nums"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: SPRING }}
        >
          {heroValue.toLocaleString()}
        </motion.div>

        <motion.p
          className="text-title font-semibold"
          style={{ color: "var(--color-text-secondary)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3, ease: SMOOTH }}
        >
          {heroLabel}
        </motion.p>

        {punchline && (
          <motion.p
            className="mt-8 short:mt-5 text-title font-semibold max-w-sm"
            style={{ color: "var(--color-text)", textWrap: "balance" }}
            // Blur is a filter, which MotionConfig's reducedMotion does not cover: opacity only.
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, filter: "blur(6px)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.8, duration: 0.45, ease: SMOOTH }}
          >
            {withSpokenApprox(punchline)}
          </motion.p>
        )}

        {estimated && !empty && (
          <motion.p
            className="text-xs mt-3"
            style={{ color: "var(--color-muted)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.3, ease: SMOOTH }}
          >
            Hours estimated from title counts
          </motion.p>
        )}
      </div>
    </div>
  );
}
