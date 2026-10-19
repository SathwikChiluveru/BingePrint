"use client";

import { motion } from "framer-motion";
import type { WrappedStats } from "@/types";

interface Props {
  // Accepted for a uniform slide API; the intro does not read stats.
  stats?: WrappedStats;
}

const EASE = [0.4, 0, 0.2, 1] as const;

export function Slide1Intro({}: Props) {
  return (
    <div className="slide-container slide-stack items-center text-center px-6">
      <motion.p
        className="text-xs font-semibold uppercase mb-4"
        style={{ letterSpacing: "0.1em", color: "var(--color-muted)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        Every episode. Every &ldquo;just one more.&rdquo;
      </motion.p>

      <div className="relative">
        {/* Background glow behind the hero wordmark */}
        <div
          aria-hidden="true"
          className="absolute -inset-24 pointer-events-none"
          style={{ background: "var(--glow-hero)" }}
        />
        <motion.h1
          className="relative text-display font-black mb-6 short:mb-4"
          style={{ textWrap: "balance" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: EASE }}
        >
          Your all-time
          <br />
          <span style={{ color: "var(--color-red)" }}>reel</span>
        </motion.h1>
      </div>

      <motion.p
        className="text-base max-w-sm"
        style={{ color: "var(--color-text-secondary)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4, ease: EASE }}
      >
        Netflix kept receipts. Let&apos;s read them out loud.
      </motion.p>

      <motion.p
        className="mt-8 short:mt-5 text-sm"
        style={{ color: "var(--color-muted)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.4, ease: EASE }}
      >
        {/* CSS picks the hint by input type, so server and client render the same markup. */}
        <span className="pointer-coarse:hidden">Press the right arrow key or click to start</span>
        <span className="hidden pointer-coarse:inline">Tap or swipe to start</span>
      </motion.p>
    </div>
  );
}
