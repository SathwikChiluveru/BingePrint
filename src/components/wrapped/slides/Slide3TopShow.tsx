"use client";

import { Fragment } from "react";
import { motion } from "framer-motion";
import type { ShowStat, WrappedStats } from "@/types";
import { playNoun } from "@/lib/csv/stats";

interface Props {
  stats: Pick<WrappedStats, "topShows" | "hasTimeData" | "totalEpisodesEstimate">;
}

const SPRING: [number, number, number, number] = [0.34, 1.56, 0.64, 1];
const SMOOTH: [number, number, number, number] = [0.4, 0, 0.2, 1];


function formatHours(totalSeconds: number, approx: string): string {
  const hours = Math.round(totalSeconds / 3600);
  if (hours < 1) return `${approx ? "~" : ""}under 1 hour`;
  return `${approx}${hours.toLocaleString()} ${hours === 1 ? "hour" : "hours"}`;
}

/** Screen readers announce "~" as "tilde"; each one is spoken as "about" instead. */
function withSpokenApprox(text: string) {
  return text.split("~").map((part, i) => (
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

/** Teases with the show's share of everything watched; never comments on anything but viewing. */
function topShowQuip(top: ShowStat, totalTitles: number): string {
  const count = top.watchCount;
  if (count <= 1) return "It won with a single watch. The competition was not fierce.";
  const share = totalTitles > 0 ? count / totalTitles : 0;
  if (share >= 0.5) return "More than half of everything you ever played. Other shows never stood a chance.";
  const tail =
    count > 30
      ? "You could write its Wikipedia article."
      : count > 15
      ? "You quote it in conversations it has nothing to do with."
      : "Not an obsession yet. Give it a long weekend.";
  if (share <= 0) return tail;
  const oneIn = Math.max(2, Math.round(1 / share));
  return `1 of every ${oneIn.toLocaleString()} titles you ever played. ${tail}`;
}

export function Slide3TopShow({ stats }: Props) {
  const top = stats.topShows?.[0];
  const approx = stats.hasTimeData !== true ? "~" : "";

  return (
    <div className="slide-container slide-stack items-center text-center px-6">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: "var(--glow-hero)" }} />

      <div className="relative flex flex-col items-center w-full max-w-md">
        <motion.p
          className="text-xs font-semibold uppercase mb-4"
          style={{ color: "var(--color-muted)", letterSpacing: "0.1em" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3, ease: SMOOTH }}
        >
          Your #1 obsession
        </motion.p>

        {top ? (
          <>
            <motion.h2
              className="w-full text-headline font-black break-words hyphens-auto text-balance mb-6"
              style={{ color: "var(--color-text)" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3, ease: SMOOTH }}
            >
              {top.title}
            </motion.h2>

            <motion.div
              className="slide-hero font-black text-gradient-red tabular-nums"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35, duration: 0.5, ease: SPRING }}
            >
              {top.watchCount.toLocaleString()}
            </motion.div>

            <motion.p
              className="text-base mt-2 tabular-nums"
              style={{ color: "var(--color-text-secondary)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.3, ease: SMOOTH }}
            >
              {/* A single watch is usually a movie, so it never reads "1 episode"; a rewatched movie reads "watches". */}
              {top.watchCount === 1 ? "watched once" : playNoun(top, top.watchCount)}
              {" · "}
              {withSpokenApprox(formatHours(top.totalSeconds, approx))}
            </motion.p>

            <motion.p
              className="mt-8 short:mt-5 text-title font-semibold max-w-sm"
              style={{ color: "var(--color-text)", textWrap: "balance" }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.4, ease: SMOOTH }}
            >
              {topShowQuip(top, stats.totalEpisodesEstimate ?? 0)}
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
              Nothing yet
            </motion.h2>
            <motion.p
              className="mt-6 text-title font-semibold max-w-sm"
              style={{ color: "var(--color-text)", textWrap: "balance" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.3, ease: SMOOTH }}
            >
              No show made it into your history. Commitment issues, or a very short export?
            </motion.p>
          </>
        )}
      </div>
    </div>
  );
}
