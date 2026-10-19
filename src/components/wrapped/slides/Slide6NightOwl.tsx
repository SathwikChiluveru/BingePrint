"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { WrappedStats } from "@/types";

interface Props {
  stats: Pick<WrappedStats, "nightOwlScore" | "peakHour">;
}

const EASE = [0.4, 0, 0.2, 1] as const;
const SPRING = [0.34, 1.56, 0.64, 1] as const;

// Matches the "The Night Owl" personality threshold in src/lib/csv/stats.ts.
const NIGHT_OWL_THRESHOLD = 60;
const SPLIT_SHIFT_THRESHOLD = 35;

// Length of the semicircle path below (pi * r, r = 70), rounded up so 0% hides the stroke fully.
const ARC_LENGTH = 220;

function formatHour(h: number) {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  return h > 12 ? `${h - 12}pm` : `${h}am`;
}

/** Tier title plus a roast built on the user's own peak hour (omitted when it is unusable). */
function getTier(score: number, peakHour: number | null) {
  const peak = peakHour === null ? "" : `Peak hour: ${formatHour(peakHour)}. `;
  if (score > NIGHT_OWL_THRESHOLD) {
    return { title: "Certified night owl", line: `${peak}Sleep is just a loading screen between episodes.` };
  }
  if (score >= SPLIT_SHIFT_THRESHOLD) {
    return { title: "Working both shifts", line: `${peak}Day shift, night shift. The remote clocks in for both.` };
  }
  return { title: "Early bird", line: `${peak}Watching TV at a reasonable hour? Suspicious.` };
}

export function Slide6NightOwl({ stats }: Props) {
  // Old or partial stored stats can carry undefined/NaN here; treat those as 0% / no peak.
  const rawScore = Number(stats.nightOwlScore);
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0;
  const rawPeak = Number(stats.peakHour);
  const peakHour = Number.isInteger(rawPeak) && rawPeak >= 0 && rawPeak <= 23 ? rawPeak : null;
  const tier = getTier(score, peakHour);
  const offset = ARC_LENGTH - (score / 100) * ARC_LENGTH;
  // MotionConfig reducedMotion="user" only drops transforms; the arc draw and its delays
  // would still play, so reduced motion renders the final state outright.
  const reduce = useReducedMotion();

  return (
    <div className="slide-container slide-stack items-center text-center px-6">
      <motion.p
        className="text-xs font-semibold uppercase mb-6 short:mb-4"
        style={{ letterSpacing: "0.1em", color: "var(--color-muted)" }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: EASE }}
      >
        {tier.title}
      </motion.p>

      {/* Score arc: neutral gauge framing the hero; the % is the one red thing */}
      <div className="relative w-full max-w-80 aspect-[2/1] mb-6 short:mb-4 short:max-w-64">
        <div
          aria-hidden="true"
          className="absolute -inset-16 pointer-events-none"
          style={{ background: "var(--glow-hero)" }}
        />
        <svg viewBox="0 0 160 80" className="relative w-full h-full overflow-visible" aria-hidden="true">
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke="var(--color-track)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <motion.path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke="var(--color-text-secondary)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={ARC_LENGTH}
            initial={reduce ? false : { strokeDashoffset: ARC_LENGTH }}
            animate={{ strokeDashoffset: offset }}
            transition={reduce ? { duration: 0 } : { delay: 0.4, duration: 0.8, ease: EASE }}
          />
        </svg>
        <motion.div
          className="absolute bottom-0 inset-x-0 slide-hero font-black text-gradient-red tabular-nums"
          initial={reduce ? false : { opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? { duration: 0 } : { delay: 0.3, duration: 0.5, ease: SPRING }}
        >
          {score.toLocaleString()}
          <span className="slide-hero-unit">%</span>
        </motion.div>
      </div>

      <motion.p
        className="text-base"
        style={{ color: "var(--color-text-secondary)" }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4, ease: EASE }}
      >
        of your watching starts between 10pm and 4am
      </motion.p>

      <motion.p
        className="mt-6 short:mt-4 text-title font-semibold max-w-sm"
        style={{ color: "var(--color-text)", textWrap: "balance" }}
        initial={reduce ? false : { opacity: 0, filter: "blur(6px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ delay: 0.95, duration: 0.5, ease: EASE }}
      >
        {tier.line}
      </motion.p>
    </div>
  );
}
