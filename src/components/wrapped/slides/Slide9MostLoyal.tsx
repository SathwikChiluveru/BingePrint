"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { WrappedStats } from "@/types";
import { playNoun } from "@/lib/csv/stats";
import { HeroGlow } from "./HeroGlow";

interface Props {
  stats: Pick<WrappedStats, "mostLoyalShow" | "hasTimeData" | "uniqueShowsCount">;
}

const SPRING: [number, number, number, number] = [0.34, 1.56, 0.64, 1];
const SMOOTH: [number, number, number, number] = [0.4, 0, 0.2, 1];
const OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];


/** Under an hour already reads as a hedge, so it skips the "~". */
function Hours({ totalSeconds, estimated }: { totalSeconds: number; estimated: boolean }) {
  const hours = Math.round((totalSeconds || 0) / 3600);
  if (hours < 1) return <>under 1 hour</>;
  return (
    <>
      {/* "~" is read aloud as "tilde"; screen readers get "about" instead. */}
      {estimated && (
        <>
          <span aria-hidden="true">~</span>
          <span className="sr-only">about </span>
        </>
      )}
      {hours.toLocaleString()} {hours === 1 ? "hour" : "hours"}
    </>
  );
}

/** Sets the one show against every other show the user tried. */
function loyalQuip(count: number, uniqueShows: number): string {
  if (count <= 1) return "Your most-watched show, watched once. Loyalty is a strong word.";
  // Old stored stats may lack the show count; fall back to a line that needs only this show.
  if (uniqueShows <= 0) return `${count.toLocaleString()} plays deep. At this point it's a personality trait.`;
  if (uniqueShows === 1) return "The only show you have ever watched. Netflix has others, you know.";
  const others = uniqueShows - 1;
  return `${others.toLocaleString()} other ${others === 1 ? "show" : "shows"} auditioned. This one got ${count.toLocaleString()} callbacks.`;
}

export function Slide9MostLoyal({ stats }: Props) {
  // mostLoyalShow falls back to topShows[0], which is undefined when there are 0 shows
  const show = stats.mostLoyalShow as WrappedStats["mostLoyalShow"] | undefined;
  const estimated = stats.hasTimeData !== true;
  const count = show?.watchCount ?? 0;
  // MotionConfig reducedMotion="user" only drops transforms; the blur-in would still
  // play, so reduced motion renders the quip in its final state.
  const reduce = useReducedMotion();

  return (
    <div className="slide-container slide-stack items-center px-6">
      {/*
        Right-aligned, entering from the right frame edge: the mirror of the left-aligned
        leaderboard and binge slides, so the reel does not settle into one centered stack.
        The glow is anchored to the hero (HeroGlow), never the slide center.
      */}
      <div className="relative flex flex-col items-end text-right w-full max-w-md">
        <motion.p
          className="text-xs font-semibold uppercase mb-4"
          style={{ color: "var(--color-muted)", letterSpacing: "0.1em" }}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.3, ease: SMOOTH }}
        >
          Ride or die
        </motion.p>

        {show ? (
          <>
            {/* Number first, then the show: a different read order from the top-show slide */}
            <div className="relative">
              <HeroGlow />
              {/* Wipes in from the right edge (clip-path) instead of the spring pop the other slides use */}
              <motion.div
                role="heading"
                aria-level={2}
                className="relative slide-hero font-black text-gradient-red tabular-nums"
                initial={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, x: 48, clipPath: "inset(-10% -10% -10% 100%)" }
                }
                animate={
                  reduce ? { opacity: 1 } : { opacity: 1, x: 0, clipPath: "inset(-10% -10% -10% -10%)" }
                }
                transition={{ delay: 0.2, duration: reduce ? 0.4 : 0.65, ease: reduce ? SMOOTH : OUT_EXPO }}
              >
                {count.toLocaleString()}
              </motion.div>
            </div>

            <motion.p
              className="text-base mt-2"
              style={{ color: "var(--color-text-secondary)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.3, ease: SMOOTH }}
            >
              {count === 1 ? "watch, and it was" : `${playNoun(show, count)} of`}
            </motion.p>

            <motion.h2
              className="w-full text-headline font-black break-words hyphens-auto text-balance mt-1"
              style={{ color: "var(--color-text)" }}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55, duration: 0.35, ease: SMOOTH }}
            >
              {show.title}
            </motion.h2>

            <motion.p
              className="text-sm mt-2 tabular-nums"
              style={{ color: "var(--color-muted)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.3, ease: SMOOTH }}
            >
              <Hours totalSeconds={show.totalSeconds} estimated={estimated} />
            </motion.p>

            <motion.p
              className="mt-8 short:mt-5 text-title font-semibold max-w-sm"
              style={{ color: "var(--color-text)", textWrap: "balance" }}
              initial={reduce ? false : { opacity: 0, filter: "blur(6px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ delay: 0.9, duration: 0.5, ease: SMOOTH }}
            >
              {loyalQuip(count, stats.uniqueShowsCount ?? 0)}
            </motion.p>
          </>
        ) : (
          <>
            <motion.h2
              className="text-display font-black"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5, ease: SPRING }}
            >
              Free agent
            </motion.h2>
            <motion.p
              className="mt-6 text-title font-semibold max-w-sm"
              style={{ color: "var(--color-text)", textWrap: "balance" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.3, ease: SMOOTH }}
            >
              No show has your loyalty yet. Netflix is still auditioning.
            </motion.p>
          </>
        )}
      </div>
    </div>
  );
}
