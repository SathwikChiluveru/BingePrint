"use client";

import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import type { WrappedStats } from "@/types";
import { isPendingInviteFresh, useAutoplayedStore } from "@/lib/store";
import { groupNameForButton } from "@/lib/copy/invite";
import { Slide1Intro } from "./slides/Slide1Intro";
import { Slide2TotalHours } from "./slides/Slide2TotalHours";
import { Slide3TopShow } from "./slides/Slide3TopShow";
import { Slide4TopShows, distinctTitlesPhrase, topShowsHero } from "./slides/Slide4TopShows";
import { Slide5BingeBeast } from "./slides/Slide5BingeBeast";
import { Slide6NightOwl } from "./slides/Slide6NightOwl";
import { Slide7DayHeatmap } from "./slides/Slide7DayHeatmap";
import { Slide8Personality } from "./slides/Slide8Personality";
import { Slide9MostLoyal } from "./slides/Slide9MostLoyal";
import { Slide10Share } from "./slides/Slide10Share";
import { SlideThreeAm, threeAmSummary } from "./slides/SlideThreeAm";
import { SlideRelapse, hasRelapses, relapseSummary } from "./slides/SlideRelapse";
import { SlideGraveyard, graveyardSummary, hasGraveyard } from "./slides/SlideGraveyard";

interface Props {
  stats: WrappedStats;
  sessionId: string;
}

const EASE = [0.4, 0, 0.2, 1] as const;

const noopSubscribe = () => () => {};
const getHost = () => window.location.host;
const getServerHost = () => "";

// Space reserved at the bottom of every slide for the counter + dots
// (8px offset + 16px counter + 44px dots + 4px), plus the home-indicator inset.
const SAFE_BOTTOM = "env(safe-area-inset-bottom, 0px)";
const NAV_RESERVE = `calc(72px + ${SAFE_BOTTOM})`;

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? "-100%" : "100%",
    opacity: 0,
  }),
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

// Taps that land on these are the control's own business, not a page turn.
const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [contenteditable="true"], [data-no-tap]';
// Movement beyond this (px) means a swipe or scroll, not a tap.
const TAP_SLOP = 10;
// Holding longer than this is a long-press (text selection, context menu).
const TAP_MAX_MS = 500;

// Announced and used as each slide's accessible name, keyed by component.
// Listed in reel order: Most loyal plays before Personality so the reel ends
// on the verdict and then the card.
const SLIDE_TITLES = new Map<unknown, string>([
  [Slide1Intro, "Intro"],
  [Slide2TotalHours, "Total watched"],
  [Slide3TopShow, "Top show"],
  [Slide4TopShows, "Top five"],
  [Slide5BingeBeast, "Biggest binge"],
  [Slide6NightOwl, "Night owl"],
  [SlideThreeAm, "The 3am Report"],
  [Slide7DayHeatmap, "Your week"],
  [SlideRelapse, "Relapse tracker"],
  [SlideGraveyard, "The graveyard"],
  [Slide9MostLoyal, "Most loyal"],
  [Slide8Personality, "Personality"],
  [Slide10Share, "Your card"],
]);

const DAY_NAMES: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * Each slide's hero in a few words, announced with its title ("Top five: 22% of everything you
 * watched, slide 4 of 8"), so the live region carries the number and not just the slide's name.
 * Estimates say "about"; null when the slide has no hero to state.
 */
function slideSummary(type: unknown, stats: WrappedStats): string | null {
  const estimated = stats.hasTimeData !== true;
  switch (type) {
    case Slide2TotalHours: {
      const titles = Number(stats.totalEpisodesEstimate) || 0;
      const hours = Number(stats.totalHours) || 0;
      if (titles <= 0 && hours <= 0) return null;
      return estimated ? plural(titles, "title", "titles") : plural(hours, "hour", "hours");
    }
    case Slide3TopShow:
      return stats.topShows?.[0]?.title ?? null;
    case Slide4TopShows: {
      // Same hero as the slide: the top list's share, or with 5 or fewer the distinct count.
      const hero = topShowsHero(stats);
      if (!hero) return null;
      return hero.kind === "share" ? `${hero.value}% of everything you watched` : distinctTitlesPhrase(hero.value);
    }
    case Slide5BingeBeast: {
      const b = stats.longestBinge;
      const seconds = b?.totalSeconds ?? 0;
      if (!b || seconds <= 0) return null;
      if (estimated) {
        const count = b.titleCount ?? b.showCount ?? b.titles?.length ?? 0;
        return count > 0 ? `${plural(count, "title", "titles")} in one day` : null;
      }
      const totalMins = Math.round(seconds / 60);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      return `${plural(h, "hour", "hours")}${m > 0 ? ` ${plural(m, "minute", "minutes")}` : ""} straight`;
    }
    case Slide6NightOwl: {
      // Same tier title as the slide (Slide6NightOwl getTier), so the summary never contradicts it.
      const raw = Number(stats.nightOwlScore);
      if (!Number.isFinite(raw)) return null;
      const score = Math.max(0, Math.min(100, Math.round(raw)));
      const rawPeak = Number(stats.peakHour);
      const peakHour = Number.isInteger(rawPeak) && rawPeak >= 0 && rawPeak <= 23 ? rawPeak : null;
      const title =
        score > 60
          ? "Certified night owl"
          : score >= 35
            ? "Working both shifts"
            : peakHour === null
              ? "Mostly daytime"
              : peakHour >= 5 && peakHour < 12
                ? "Early bird"
                : peakHour >= 12 && peakHour <= 21
                  ? "Prime-time regular"
                  : "Occasional night owl";
      return `${title}: ${score}% after 10pm`;
    }
    case Slide7DayHeatmap: {
      const counts = stats.dayTitleCounts;
      const days =
        estimated && Array.isArray(counts) && counts.length > 0
          ? counts.map((d) => ({ day: d.day, value: d.count }))
          : (stats.dayHeatmap ?? []).map((d) => ({ day: d.day, value: d.hours }));
      const peak = days.reduce<{ day: string; value: number } | null>((a, b) => (!a || b.value > a.value ? b : a), null);
      return peak && peak.value > 0 ? `you live for ${DAY_NAMES[peak.day] ?? peak.day}s` : null;
    }
    case SlideThreeAm:
      return threeAmSummary(stats) || null;
    case SlideRelapse:
      return relapseSummary(stats).replace(/^Relapse:\s*/, "") || null;
    case SlideGraveyard:
      return graveyardSummary(stats) || null;
    case Slide9MostLoyal:
      return stats.mostLoyalShow?.title ?? null;
    case Slide8Personality:
      return stats.personality?.trim() || null;
    default:
      return null;
  }
}

// Set once a reel has reached its card, so a returning viewer gets "Skip to my card" on the intro.
// localStorage: survives the tab closing. Storage can throw (private mode, blocked).
const VIEWED_KEY_PREFIX = "autoplayed:viewed:";

function readViewed(sessionId: string): boolean {
  try {
    return window.localStorage.getItem(VIEWED_KEY_PREFIX + sessionId) === "1";
  } catch {
    return false;
  }
}

function writeViewed(sessionId: string) {
  try {
    window.localStorage.setItem(VIEWED_KEY_PREFIX + sessionId, "1");
  } catch {
    // Storage unavailable: no skip link next time.
  }
}

// Current slide per reel, so a reload or an app switch resumes where the viewer was.
// sessionStorage: per tab, gone when the tab closes. Storage can throw (private mode, blocked).
const SLIDE_KEY_PREFIX = "autoplayed:slide:";

function readStoredSlide(sessionId: string, totalSlides: number): number {
  try {
    const raw = window.sessionStorage.getItem(SLIDE_KEY_PREFIX + sessionId);
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && n >= 0 ? Math.min(n, totalSlides - 1) : 0;
  } catch {
    return 0;
  }
}

/** Start this reel from slide 1 next time it mounts ("Watch my reel" from the card view). */
export function resetStoredSlide(sessionId: string) {
  writeStoredSlide(sessionId, 0);
}

function writeStoredSlide(sessionId: string, index: number) {
  try {
    window.sessionStorage.setItem(SLIDE_KEY_PREFIX + sessionId, String(index));
  } catch {
    // Storage unavailable: the reel just restarts on reload.
  }
}

// How a navigation was triggered. Focus only moves for deliberate (non-gesture) input.
type NavSource = "keyboard" | "button" | "gesture";

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function SlideShow({ stats, sessionId }: Props) {
  // Exit confirm popover, anchored to the X. Leaving is not destructive (stats
  // persist on this device) but it does drop the reel, so it takes two taps.
  const [exitOpen, setExitOpen] = useState(false);
  const exitButtonRef = useRef<HTMLButtonElement>(null);
  const exitStayRef = useRef<HTMLButtonElement>(null);
  const exitPopoverRef = useRef<HTMLDivElement>(null);
  // Host for the screenshot watermark; empty during SSR so hydration matches.
  const host = useSyncExternalStore(noopSubscribe, getHost, getServerHost);
  // Only show time-of-day slides when the stats say so outright. New uploads always set
  // hasTimeData; older stored stats may lack it, and a date-only export without the flag would
  // otherwise read as a "noon" night owl.
  const hasTimeData = stats.hasTimeData === true;
  // Slide 9 repeats slide 3 when the most-loyal show is also the top show.
  const showMostLoyal =
    Boolean(stats.mostLoyalShow?.title) &&
    stats.mostLoyalShow?.title !== stats.topShows?.[0]?.title;

  // An empty history has nothing to show on slides 2 to 9: the intro goes straight to the card's
  // empty state (same test as Slide10Share).
  const emptyReel = !(Number(stats.totalEpisodesEstimate) > 0) && !(Number(stats.totalHours) > 0);

  const allSlides = [
    <Slide1Intro key="1" stats={stats} />,
    <Slide2TotalHours key="2" stats={stats} />,
    <Slide3TopShow key="3" stats={stats} />,
    <Slide4TopShows key="4" stats={stats} />,
    <Slide5BingeBeast key="5" stats={stats} />,
    // Night owl score and peak hour are meaningless without time-of-day data.
    hasTimeData ? <Slide6NightOwl key="6" stats={stats} /> : null,
    // Full exports get the heatmap; quick exports get its locked teaser with the how-to.
    <SlideThreeAm key="3am" stats={stats} />,
    <Slide7DayHeatmap key="7" stats={stats} />,
    hasRelapses(stats) ? <SlideRelapse key="relapse" stats={stats} /> : null,
    hasGraveyard(stats) ? <SlideGraveyard key="graveyard" stats={stats} /> : null,
    showMostLoyal ? <Slide9MostLoyal key="9" stats={stats} /> : null,
    // Personality is the climax: it plays last, right before the card.
    <Slide8Personality key="8" stats={stats} />,
    <Slide10Share key="10" stats={stats} sessionId={sessionId} />,
  ].filter((s): s is React.JSX.Element => s !== null);
  const slides = emptyReel ? [allSlides[0], allSlides[allSlides.length - 1]] : allSlides;
  const totalSlides = slides.length;

  // Only rendered on the client (the page waits for hydration), so storage is readable here.
  const [current, setCurrent] = useState(() => readStoredSlide(sessionId, totalSlides));
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    writeStoredSlide(sessionId, current);
  }, [sessionId, current]);

  // Read once per mount: a viewer who reaches the card this visit doesn't see the skip until next time.
  const [viewedBefore] = useState(() => readViewed(sessionId));
  useEffect(() => {
    if (current === totalSlides - 1) writeViewed(sessionId);
  }, [sessionId, current, totalSlides]);

  // An invite the viewer arrived through (same test as Slide10Share): the intro tells them their
  // group waits at the end. Not on an empty reel, whose card has no group step.
  const pendingInvite = useAutoplayedStore((s) => s.pendingInvite);
  const myGroup = useAutoplayedStore((s) => s.myGroup);
  const invited =
    !emptyReel && isPendingInviteFresh(pendingInvite) && pendingInvite.code !== myGroup?.inviteCode;
  const waitingGroup = invited ? pendingInvite?.groupName?.trim() || "Your group" : null;
  // Invitees came for the comparison: a quiet way straight to it (the card, where the group waits).
  const skipToGroupLabel = invited ? `Skip to ${groupNameForButton(pendingInvite?.groupName)}` : null;

  const sectionRef = useRef<HTMLElement>(null);
  // Set by goTo, consumed by the focus effect after the new slide commits.
  const navRef = useRef<{ source: NavSource; focusInside: boolean } | null>(null);

  const goTo = useCallback(
    (next: number, source: NavSource = "button") => {
      if (next < 0 || next >= totalSlides || next === current) return;
      const active = document.activeElement;
      navRef.current = {
        source,
        // Focus is on a control or slide content that may unmount with this move.
        focusInside: Boolean(active && active !== document.body && sectionRef.current?.contains(active)),
      };
      setDirection(next > current ? 1 : -1);
      setCurrent(next);
    },
    [current, totalSlides]
  );

  const go = useCallback(
    (delta: number, source: NavSource = "button") => goTo(current + delta, source),
    [current, goTo]
  );

  // Focus management. Runs after the new slide mounts (the old one may still be
  // animating out, and controls hidden on the last slide have already unmounted).
  useEffect(() => {
    const nav = navRef.current;
    navRef.current = null;
    if (!nav) return;
    const group = sectionRef.current?.querySelector<HTMLElement>(`[data-slide-index="${current}"]`);
    if (!group) return;
    const active = document.activeElement;
    const isLastSlide = current === totalSlides - 1;

    // Arriving at the end by keyboard or a control: land on the primary CTA.
    if (isLastSlide && nav.source !== "gesture") {
      const primary = group.querySelector<HTMLElement>("[data-slide-primary]");
      (primary ?? group).focus({ preventScroll: true });
      return;
    }

    // Focus dropped to <body> (its control unmounted), or it sits inside the
    // outgoing slide and is about to: keep it in the reel.
    const dropped = nav.focusInside && (!active || active === document.body || !active.isConnected);
    const stale = active?.closest("[data-slide-index]");
    if (dropped || (stale && stale !== group)) group.focus({ preventScroll: true });
  }, [current, totalSlides]);

  // Keyboard navigation: horizontal arrows only. Escape never drops the reel:
  // screen-reader users press it habitually. It only closes the exit popover.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (exitOpen) return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;
      if (e.key === "ArrowRight") go(1, "keyboard");
      else if (e.key === "ArrowLeft") go(-1, "keyboard");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, exitOpen]);

  // Opening the exit popover lands focus on the safe choice.
  useEffect(() => {
    if (exitOpen) exitStayRef.current?.focus({ preventScroll: true });
  }, [exitOpen]);

  function closeExit() {
    setExitOpen(false);
    exitButtonRef.current?.focus({ preventScroll: true });
  }

  // Minimal focus trap: Tab cycles inside the popover, Escape closes it only.
  function onExitKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeExit();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = exitPopoverRef.current?.querySelectorAll<HTMLElement>("a[href], button");
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Touch swipe. Slides scroll vertically on short screens, so only a clearly
  // horizontal gesture (50px+, mostly sideways) changes slide.
  const touchStart = useRef({ x: 0, y: 0 });
  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (exitOpen) return;
    const dx = touchStart.current.x - e.changedTouches[0].clientX;
    const dy = touchStart.current.y - e.changedTouches[0].clientY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx > 0 ? 1 : -1, "gesture");
  }

  // Tap zones (Stories convention): left third goes back, the rest advances.
  // Pointer tracking rejects drags, scrolls and long-presses; on touch the
  // click event itself never fires after a native scroll.
  const tapStart = useRef<{ x: number; y: number; t: number; moved: boolean } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) {
      tapStart.current = null;
      return;
    }
    tapStart.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const start = tapStart.current;
    if (!start || !e.isPrimary || start.moved) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP) start.moved = true;
  }
  function onPointerCancel() {
    tapStart.current = null;
  }
  function onSlideClick(e: React.MouseEvent<HTMLDivElement>) {
    const start = tapStart.current;
    tapStart.current = null;
    // Keyboard-synthesised clicks (detail 0) and untracked pointers are not taps.
    if (!start || e.detail === 0 || start.moved || e.timeStamp - start.t > TAP_MAX_MS) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP) return;
    if (e.defaultPrevented || e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    // The last slide is CTAs; taps there must never page.
    if (current === totalSlides - 1) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest(INTERACTIVE_SELECTOR)) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim() !== "") return;
    const rect = e.currentTarget.getBoundingClientRect();
    go(e.clientX - rect.left < rect.width / 3 ? -1 : 1, "gesture");
  }

  const position = `${current + 1} of ${totalSlides}`;
  const title = SLIDE_TITLES.get(slides[current].type) ?? "Slide";
  const summary = slideSummary(slides[current].type, stats);
  // The share slide is the screenshot frame: no dots over it, and the exit
  // button only on desktop (md+), where it sits clear of the narrow card.
  const isLast = current === totalSlides - 1;
  const showWatermark = current > 0 && !isLast;
  // Dot hit width shrinks so all dots fit a 320px screen (28px each at 10 slides).
  const dotWidth = `min(32px, calc((100vw - 40px) / ${totalSlides}))`;

  return (
    <MotionConfig reducedMotion="user">
      <section
        className="fixed inset-0 overflow-hidden"
        style={{ background: "var(--color-bg)" }}
        aria-roledescription="carousel"
        aria-label="Your Autoplayed reel"
        ref={sectionRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence custom={direction} mode="popLayout">
          <motion.div
            key={current}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: EASE }}
            className="absolute inset-0"
          >
            {/*
              `contain: layout` makes this box the containing block for the
              slides' `position: fixed` root, so the slide ends above the nav.
              It always starts at the viewport top: .slide-stack already
              reserves 56px + the notch inset, which clears the X. Offsetting
              this box too would count the notch twice. The bottom reserves the
              counter + dots, or on the last slide the mobile Back control.
            */}
            <div
              role="group"
              aria-roledescription="slide"
              aria-label={`${title}, ${position}`}
              data-slide-index={current}
              tabIndex={-1}
              className={`absolute inset-x-0 focus:outline-none ${isLast ? "slide-last-reserve" : ""}`}
              style={{
                top: 0,
                bottom: isLast ? undefined : NAV_RESERVE,
                contain: "layout paint",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerCancel={onPointerCancel}
              onClick={onSlideClick}
            >
              {current === 0 ? (
                <Slide1Intro
                  stats={stats}
                  waitingGroup={waitingGroup}
                  onSkipToCard={viewedBefore && totalSlides > 2 ? () => goTo(totalSlides - 1, "button") : undefined}
                  skipToGroup={
                    skipToGroupLabel && totalSlides > 2
                      ? { label: skipToGroupLabel, onSkip: () => goTo(totalSlides - 1, "button") }
                      : null
                  }
                />
              ) : (
                slides[current]
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {summary ? `${title}: ${summary}` : title}, slide {position}
        </p>

        {/*
          Exit. Slides keep a 56px top spacer (.slide-stack) so it never covers
          content; the translucent backing keeps it legible when content scrolls
          under it. First tap asks, second tap leaves.
        */}
        <button
          ref={exitButtonRef}
          type="button"
          onClick={() => (exitOpen ? closeExit() : setExitOpen(true))}
          aria-label="Exit"
          aria-haspopup="dialog"
          aria-expanded={exitOpen}
          aria-controls={exitOpen ? "slideshow-exit-confirm" : undefined}
          className={`slide-chrome-btn fixed right-3 z-30 ${isLast ? "hidden md:flex" : "flex"}`}
          style={{ top: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
        >
          <CloseIcon />
        </button>

        <AnimatePresence>
          {exitOpen && (
            <motion.div
              key="exit-confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: EASE }}
              className="fixed inset-0 z-20"
            >
              {/* Catches outside taps so they close the popover instead of paging. */}
              <div aria-hidden="true" className="absolute inset-0" onClick={closeExit} />
              <motion.div
                ref={exitPopoverRef}
                id="slideshow-exit-confirm"
                role="dialog"
                aria-labelledby="slideshow-exit-title"
                aria-describedby="slideshow-exit-desc"
                onKeyDown={onExitKeyDown}
                initial={{ scale: 0.96, y: -4 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: -4 }}
                transition={{ duration: 0.15, ease: EASE }}
                className="glass absolute right-3 p-4 text-left"
                style={{
                  top: "calc(0.75rem + 52px + env(safe-area-inset-top, 0px))",
                  width: "min(18rem, calc(100vw - 24px))",
                  borderRadius: "var(--radius-lg)",
                  transformOrigin: "top right",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <p
                  id="slideshow-exit-title"
                  className="text-base font-semibold"
                  style={{ color: "var(--color-text)" }}
                >
                  Leave your reel?
                </p>
                <p
                  id="slideshow-exit-desc"
                  className="mt-1 text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Your stats stay saved on this device.
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    ref={exitStayRef}
                    type="button"
                    onClick={closeExit}
                    className="btn-secondary flex-1 px-4 text-sm"
                  >
                    Stay
                  </button>
                  <Link
                    href="/"
                    className="inline-flex flex-1 items-center justify-center min-h-[44px] px-4 text-sm font-semibold underline-offset-4 hover:underline"
                    style={{ color: "var(--color-text-secondary)", borderRadius: "var(--radius-md)" }}
                  >
                    Yes, exit
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Counter + progress dots */}
        {!isLast && (
          <nav
            aria-label="Slides"
            className="fixed left-1/2 -translate-x-1/2 z-10 flex flex-col items-center"
            style={{ bottom: `calc(0.5rem + ${SAFE_BOTTOM})` }}
          >
            {/*
              Counter, plus the screenshot attribution on slides 2 to 9 (the intro names the product,
              the card carries its own). It shares the counter's line inside the nav reserve, below
              the slide box, so it never sits over content, scrolled or not. Usher Grey at full
              opacity on Screening Room is 5.5:1.
            */}
            <p
              className="text-xs leading-4 whitespace-nowrap"
              style={{ color: "var(--color-muted)", fontVariantNumeric: "tabular-nums" }}
              aria-hidden="true"
            >
              {showWatermark && host && (
                <>
                  <span className="font-semibold">Autoplayed</span> · {host} ·{" "}
                </>
              )}
              {current + 1} / {totalSlides}
            </p>
            <div className="flex">
              {slides.map((_, i) => {
                const active = i === current;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i, "button")}
                    aria-label={`Go to ${SLIDE_TITLES.get(slides[i].type) ?? "slide"}, slide ${i + 1} of ${totalSlides}`}
                    aria-current={active ? "step" : undefined}
                    className="h-11 flex items-center justify-center rounded-full"
                    // 44px tall hit area; width shrinks with the viewport so every dot fits.
                    style={{ width: active ? `calc(${dotWidth} + 8px)` : dotWidth }}
                  >
                    <span
                      aria-hidden="true"
                      className="block rounded-full transition-all duration-200"
                      style={{
                        width: active ? 20 : 8,
                        height: 8,
                        background: active ? "var(--color-red)" : "var(--color-surface-3)",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/*
          Back (mobile, last slide). The X and dots are hidden here, and a right
          edge-swipe fires Safari's Back, so give an explicit way back.
          Bottom-left for the thumb; the last slide's group ends above it
          (.slide-last-reserve), so it never covers the card's CTAs.
        */}
        {isLast && (
          <button
            type="button"
            onClick={() => go(-1, "button")}
            aria-label="Previous slide"
            className="slide-chrome-btn fixed left-3 z-10 flex md:hidden"
            style={{ bottom: `calc(12px + ${SAFE_BOTTOM})` }}
          >
            <Chevron direction="left" />
          </button>
        )}
        {/*
          Home (mobile, last slide): the X is hidden here, so this is the exit. Quiet text, 44px tall,
          bottom-right opposite Back, inside the same reserve below the card's CTAs. No confirm: the
          reel is finished and the stats stay saved on this device.
        */}
        {isLast && (
          <Link
            href="/"
            className="fixed right-3 z-10 inline-flex md:hidden items-center min-h-[44px] px-3 text-sm underline-offset-4 hover:underline"
            style={{ bottom: `calc(12px + ${SAFE_BOTTOM})`, color: "var(--color-text-secondary)" }}
          >
            Home
          </Link>
        )}

        {/* Arrow buttons (desktop). Prev stays on the last slide; it sits left of the card. */}
        {current > 0 && (
          <button
            type="button"
            onClick={() => go(-1, "button")}
            aria-label="Previous slide"
            className="slide-chrome-btn fixed left-4 top-1/2 -translate-y-1/2 z-10 hidden md:flex"
          >
            <Chevron direction="left" />
          </button>
        )}
        {current < totalSlides - 1 && (
          <button
            type="button"
            onClick={() => go(1, "button")}
            aria-label="Next slide"
            className="slide-chrome-btn fixed right-4 top-1/2 -translate-y-1/2 z-10 hidden md:flex"
          >
            <Chevron direction="right" />
          </button>
        )}
      </section>
    </MotionConfig>
  );
}
