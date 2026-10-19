"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { PauseIcon, PlayIcon } from "./icons";
import { SAMPLE_VERSUS, SAMPLE_VERSUS_LINE } from "./sampleData";
import styles from "./landing.module.css";

const SMOOTH = [0.4, 0, 0.2, 1] as const;
const SPRING = [0.34, 1.56, 0.64, 1] as const;
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
// Long enough to read the hero and its roast line before the frame moves on
const SLIDE_MS = 5000;

type SampleSlide = {
  label: string;
  /** Small context line above the hero (e.g. the show name). */
  kicker?: string;
  /** Word heroes (personality) set smaller than number heroes so they fit the frame. */
  kind: "number" | "word" | "versus";
  hero: string;
  /** Head-to-head rows for the group frame; the first row is the leader. */
  versus?: typeof SAMPLE_VERSUS;
  line: string;
};

/**
 * Sample stats from the owner's own quick export (testdata); the roommate row is a made-up sample.
 * Always labeled as a sample. The reel opens (and rests, under reduced motion) on the group frame
 * because groups are the point.
 */
const SLIDES: SampleSlide[] = [
  {
    label: "Your group",
    hero: `You ${SAMPLE_VERSUS[0].value} vs Roommate ${SAMPLE_VERSUS[1].value}`,
    kind: "versus",
    versus: SAMPLE_VERSUS,
    line: SAMPLE_VERSUS_LINE,
  },
  {
    label: "Titles watched",
    hero: "5,626",
    kind: "number",
    line: "That's not a watch history. That's a second job.",
  },
  {
    label: "Top show",
    kicker: "Grey's Anatomy",
    hero: "341",
    kind: "number",
    line: "episodes. You've seen more surgeries than most interns.",
  },
  {
    label: "Biggest single day",
    hero: "51",
    kind: "number",
    line: "titles in one day. Bold of you to call that resting.",
  },
  {
    label: "Your personality",
    hero: "The Binge Lord",
    kind: "word",
    line: "One more episode? You've never told that lie in your life.",
  },
];

const backFrame = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
} as const;

/**
 * Portrait 9:16 preview of a wrapped reel, auto-advancing like the real slideshow.
 * Autoplay is off under reduced motion, pauses on hover/focus and while off-screen,
 * and has a visible pause control. Every entrance starts from a visible frame (transform only).
 */
export function SampleReel() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [userPlaying, setUserPlaying] = useState<boolean | null>(null);
  // Hover (mouse only), focus inside, and a press-and-hold each pause autoplay
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const held = hovered || focused || pressed;
  const [onScreen, setOnScreen] = useState(true);

  const playing = userPlaying ?? !reduce;
  const advancing = playing && !held && onScreen;

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!advancing) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [advancing, index]);

  const slide = SLIDES[index];

  return (
    <MotionConfig reducedMotion="user">
      <div ref={rootRef} className="relative mx-auto w-[min(72vw,280px)] md:w-[280px] xl:w-[340px] 2xl:w-[360px]">
        {/*
          The one glow source in the hero, centered on the reel; the glass frame blurs it.
          Neutral, not red: the red on this screen belongs to the Choose file button.
        */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -inset-x-[60%] -inset-y-[25%] ${styles.neutralGlow}`}
        />

        <motion.figure
          className="relative m-0"
          initial={{ y: 28, scale: 0.97 }}
          whileInView={{ y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
          onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setHovered(false);
            setPressed(false);
          }}
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerCancel={() => setPressed(false)}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
          }}
        >
          <div className="relative">
            {/* Two frames stacked behind, so it reads as a reel rather than a single card */}
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-[24px]"
              style={{ ...backFrame, transform: "translate(11%, 3%) rotate(5deg)", opacity: 0.5 }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-[24px]"
              style={{ ...backFrame, transform: "translate(5.5%, 1.5%) rotate(2.5deg)", opacity: 0.8 }}
            />

            <div
              role="group"
              aria-roledescription="carousel"
              aria-label="Sample Autoplayed reel"
              className={`relative flex aspect-[9/16] select-none flex-col overflow-hidden rounded-[24px] [-webkit-touch-callout:none] ${styles.reelFace}`}
            >
              <div className="flex items-center justify-between px-5 pt-5">
                <span className="text-sm font-black" style={{ letterSpacing: "-0.02em" }}>
                  Autoplayed
                </span>
                <span
                  className="rounded-[6px] px-2 py-1 text-xs font-semibold"
                  style={{
                    background: "var(--color-surface-2)",
                    color: "var(--color-text-secondary)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  Sample
                </span>
              </div>

              <div
                className="flex flex-1 flex-col items-center justify-center px-4 text-center min-[360px]:px-6"
                aria-live={advancing ? "off" : "polite"}
                aria-atomic="true"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={index}
                    className="flex w-full flex-col items-center"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.35, ease: SMOOTH }}
                  >
                    <p
                      className="text-xs font-semibold uppercase"
                      style={{ color: "var(--color-muted)", letterSpacing: "0.1em" }}
                    >
                      {slide.label}
                    </p>
                    {slide.kicker && (
                      <p className="mt-3 text-base font-semibold" style={{ color: "var(--color-text)" }}>
                        {slide.kicker}
                      </p>
                    )}

                    {slide.versus ? (
                      <motion.div
                        className="mt-4 w-full"
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.05, ease: SPRING }}
                      >
                        <p className="sr-only">{slide.hero}</p>
                        {slide.versus.map((row, i) => (
                          <div key={row.name} aria-hidden="true">
                            {i === 1 && (
                              <p
                                className="my-1 text-xs font-semibold uppercase"
                                style={{ color: "var(--color-muted)", letterSpacing: "0.1em" }}
                              >
                                vs
                              </p>
                            )}
                            <div className="flex items-baseline justify-between gap-3">
                              <span
                                className="text-sm font-semibold"
                                style={{ color: i === 0 ? "var(--color-text)" : "var(--color-text-secondary)" }}
                              >
                                {row.name}
                              </span>
                              <span
                                className="text-3xl font-black tabular-nums min-[360px]:text-4xl lg:text-5xl"
                                style={{
                                  lineHeight: 1,
                                  letterSpacing: "-0.04em",
                                  color: i === 0 ? "var(--color-text)" : "var(--color-text-secondary)",
                                }}
                              >
                                {row.value}
                              </span>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    ) : (
                      <motion.p
                        className={
                          slide.kind === "number"
                            ? "mt-3 whitespace-nowrap text-5xl font-black tabular-nums min-[360px]:text-6xl lg:text-7xl 2xl:text-8xl"
                            : "mt-4 text-3xl font-black min-[360px]:text-4xl lg:text-5xl"
                        }
                        style={{
                          color: "var(--color-text)",
                          lineHeight: 0.95,
                          letterSpacing: slide.kind === "number" ? "-0.04em" : "-0.03em",
                          textWrap: "balance",
                        }}
                        initial={{ scale: 0.85 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.05, ease: SPRING }}
                      >
                        {slide.hero}
                      </motion.p>
                    )}

                    <motion.p
                      className="mt-4 max-w-[22ch] text-sm leading-snug"
                      style={{ color: "var(--color-text-secondary)" }}
                      initial={{ y: 8 }}
                      animate={{ y: 0 }}
                      transition={{ duration: 0.4, delay: 0.2, ease: SMOOTH }}
                    >
                      {slide.line}
                    </motion.p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Progress dots mirror the real slideshow; each is a 44px-tall target */}
              <div className="flex justify-center pb-3">
                {SLIDES.map((s, i) => {
                  const active = i === index;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={`Sample slide ${i + 1} of ${SLIDES.length}: ${s.label}`}
                      aria-current={active ? "true" : undefined}
                      className="flex h-11 w-10 items-center justify-center rounded-full"
                    >
                      <span
                        aria-hidden="true"
                        className="block h-2 rounded-full transition-all duration-300"
                        style={{
                          width: active ? 20 : 8,
                          background: active ? "var(--color-text)" : "var(--color-surface-3)",
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <figcaption
            className="mt-4 flex items-center justify-between gap-3 text-sm"
            style={{ color: "var(--color-muted)" }}
          >
            <span>Sample Autoplayed reel. Yours is built from your own history.</span>
            <button
              type="button"
              onClick={() => setUserPlaying(!playing)}
              aria-label={playing ? "Pause sample slides" : "Play sample slides"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:text-white"
              style={{ border: "1px solid var(--color-border)" }}
            >
              {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
            </button>
          </figcaption>
        </motion.figure>
      </div>
    </MotionConfig>
  );
}
