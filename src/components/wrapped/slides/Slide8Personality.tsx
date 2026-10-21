"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { WrappedStats } from "@/types";

interface Props {
  stats: Pick<WrappedStats, "personality" | "personalityDescription" | "totalEpisodesEstimate">;
}

const EASE_SMOOTH = [0.4, 0, 0.2, 1] as const;
// Confident arrival with no overshoot: the stamp lands, it does not bounce.
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const kickerStyle = { letterSpacing: "0.1em", color: "var(--color-muted)" } as const;

/*
  The climax word is the biggest type in the reel (numeric heroes top out at 8rem but sit at
  ~83px on phones). "The" steps down to a headline line so the label itself stays within two
  lines at 320px: "Weekend / Warrior", "Casual / Viewer".
*/
const heroWordStyle = {
  fontSize: "clamp(3.5rem, 15vw, 6.5rem)",
  lineHeight: 0.92,
  letterSpacing: "-0.04em",
  textWrap: "balance",
  // background-clip:text only paints inside the box, and 0.92 line-height leaves descenders
  // ("g" in Binge) outside it. Pad the box down to cover them without moving the layout.
  paddingBottom: "0.16em",
  marginBottom: "-0.16em",
} as const;

/*
  The verdict timeline, the one authored moment in the reel. Every other slide pops its hero in
  with the spring; this one is stamped: the word wipes in left to right behind a closing clip,
  settling from 1.15x with a short blur while its glow swells past resting strength. Then a held
  beat of silence before the description lands.
*/
const T_ARTICLE = 0.35;
const T_STAMP = 0.6;
const STAMP_DURATION = 0.75;
const T_GLOW_PEAK = T_STAMP + STAMP_DURATION;
// The held beat: the word sits alone for ~0.6s before the description.
const T_DESCRIPTION = T_GLOW_PEAK + 0.6;
const T_DIG = T_DESCRIPTION + 0.6;

const FALLBACK_PERSONALITY = "The Casual Viewer";

export function Slide8Personality({ stats }: Props) {
  // Clip-path, blur, scale and the glow swell are all motion; MotionConfig only drops transforms,
  // so reduced motion gets its own path: everything in place, a gentle opacity sequence only.
  const reduce = useReducedMotion();
  // Stats stored before personality existed come back without it; never render an empty climax.
  const personality = stats.personality?.trim() || FALLBACK_PERSONALITY;
  const titles = stats.totalEpisodesEstimate ?? 0;
  const description =
    stats.personalityDescription?.trim() ||
    `${titles.toLocaleString()} ${titles === 1 ? "title" : "titles"}, all-time. Netflix keeps asking if you're still watching.`;

  const hasArticle = /^the\s+/i.test(personality);
  const article = hasArticle ? personality.slice(0, 3) : null;
  const label = hasArticle ? personality.replace(/^the\s+/i, "") : personality;

  return (
    <div className="slide-container slide-stack items-center text-center px-6">
      <motion.p
        className="relative text-xs font-semibold uppercase mb-6 short:mb-4"
        style={kickerStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: EASE_SMOOTH }}
      >
        Your Netflix personality
      </motion.p>

      <h2 className="relative mb-6 short:mb-4 max-w-full">
        {/*
          The frame's one glow source, anchored to the verdict. Two stacked --glow-hero layers give
          the swell headroom; it peaks as the stamp lands, then settles near resting strength.
        */}
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2"
          style={{
            width: "min(110vw, 40rem)",
            height: "min(70vh, 30rem)",
            background: "var(--glow-hero), var(--glow-hero)",
          }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
          animate={reduce ? { opacity: 0.6 } : { opacity: [0, 0.35, 1, 0.6], scale: [0.7, 0.85, 1.15, 1] }}
          transition={
            reduce
              ? { duration: 0.6, delay: 0.2, ease: EASE_SMOOTH }
              : {
                  duration: T_GLOW_PEAK + 0.9,
                  times: [0, T_STAMP / (T_GLOW_PEAK + 0.9), T_GLOW_PEAK / (T_GLOW_PEAK + 0.9), 1],
                  ease: EASE_SMOOTH,
                }
          }
        />

        {article && (
          <motion.span
            className="relative block text-headline font-black mb-1"
            style={{ color: "var(--color-text-secondary)" }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0.15 : T_ARTICLE, duration: 0.35, ease: EASE_SMOOTH }}
          >
            {article}{" "}
          </motion.span>
        )}

        {/* Clip-path on the whole word, not per letter: the gradient fill is clipped to the word's text */}
        <motion.span
          className="relative block font-black text-gradient-red break-words"
          style={heroWordStyle}
          initial={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, scale: 1.15, clipPath: "inset(-20% 100% -20% 0%)", filter: "blur(10px)" }
          }
          animate={
            reduce
              ? { opacity: 1 }
              : { opacity: 1, scale: 1, clipPath: "inset(-20% 0% -20% 0%)", filter: "blur(0px)" }
          }
          transition={
            reduce
              ? { delay: 0.3, duration: 0.5, ease: EASE_SMOOTH }
              : {
                  delay: T_STAMP,
                  duration: STAMP_DURATION,
                  ease: EASE_OUT_EXPO,
                  opacity: { delay: T_STAMP, duration: 0.2 },
                }
          }
        >
          {label}
        </motion.span>
      </h2>

      <motion.p
        className="relative text-title font-semibold max-w-sm break-words"
        style={{ color: "var(--color-text)", textWrap: "balance" }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0.7 : T_DESCRIPTION, duration: 0.45, ease: EASE_SMOOTH }}
      >
        {description}
      </motion.p>

      {/* Sets up the invite on the next slide without assuming a group exists; teases viewing habits only. */}
      <motion.p
        className="relative mt-6 short:mt-4 text-sm max-w-sm"
        style={{ color: "var(--color-text-secondary)", textWrap: "balance" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 1 : T_DIG, duration: 0.3, ease: EASE_SMOOTH }}
      >
        Somebody you know is going to argue with this.
      </motion.p>
    </div>
  );
}
