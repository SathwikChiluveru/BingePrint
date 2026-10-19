"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { isInAppBrowser } from "@/lib/share/safety";
import { IN_APP_OPEN_LINE, NETFLIX_FILE_STEPS, inviteUrl } from "@/lib/copy/invite";
import { displayInviteCode, type OwnerTeaser } from "@/lib/supabase/groups";
import { CheckIcon, CopyIcon } from "./icons";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_SMOOTH = [0.4, 0, 0.2, 1] as const;

const noopSubscribe = () => () => {};

/** False on the server and the first client render, so markup never mismatches. */
export function useInAppBrowser() {
  return useSyncExternalStore(
    noopSubscribe,
    () => isInAppBrowser(),
    () => false
  );
}

// Same scale as the reel's personality climax: the biggest word on the screen, two lines max
const heroWordStyle = {
  fontSize: "clamp(3.5rem, 15vw, 6.5rem)",
  lineHeight: 0.92,
  letterSpacing: "-0.04em",
  textWrap: "balance",
} as const;

// Group names run up to 60 characters, so they step down from the personality size
const heroNameStyle = {
  fontSize: "clamp(2.5rem, 10vw, 4.5rem)",
  lineHeight: 0.95,
  letterSpacing: "-0.03em",
  textWrap: "balance",
} as const;

/**
 * The invite landing as a reel frame: kicker, one hero word over the glow, one roast line, then
 * the page's action. With the owner's teaser the hero is their personality; without it, the group.
 * The hero stays white: the CTA below is the frame's one red thing.
 */
export default function InviteFrame({
  groupName,
  teaser,
  children,
}: {
  groupName: string;
  teaser: OwnerTeaser | null;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const personality = teaser?.personality.trim() ?? "";
  const hasArticle = /^the\s+/i.test(personality);
  const article = hasArticle ? personality.slice(0, 3) : null;
  const word = hasArticle ? personality.replace(/^the\s+/i, "") : personality;

  return (
    <section className="relative flex flex-col items-center text-center">
      <h1 className="relative max-w-full">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2"
          style={{ width: "min(110vw, 40rem)", height: "min(70vh, 30rem)", background: "var(--glow-hero)" }}
        />
        <span
          className="relative block text-xs font-semibold uppercase mb-6"
          style={{ letterSpacing: "0.1em", color: "var(--color-muted)" }}
        >
          {teaser ? "Your friend is" : "You're invited to"}
        </span>
        {teaser && article && (
          <span className="relative block text-headline font-black mb-1" style={{ color: "var(--color-text-secondary)" }}>
            {article}{" "}
          </span>
        )}
        <motion.span
          className="relative block font-black break-words"
          style={{ ...(teaser ? heroWordStyle : heroNameStyle), color: "var(--color-text)" }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.08, filter: "blur(8px)" }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: reduce ? 0.3 : 0.7, ease: EASE_OUT_EXPO }}
        >
          {teaser ? word || personality : groupName}
        </motion.span>
      </h1>

      <motion.div
        className="relative mt-6 flex max-w-sm flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0.1 : 0.5, duration: 0.4, ease: EASE_SMOOTH }}
      >
        {teaser ? (
          <>
            <p className="text-title font-semibold" style={{ color: "var(--color-text)", textWrap: "balance" }}>
              <span className="tabular-nums">{teaser.statValue}</span> {teaser.statLabel}. Think you watch less?
            </p>
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              They want you in <span className="font-semibold" style={{ color: "var(--color-text)" }}>{groupName}</span>.
            </p>
          </>
        ) : (
          <p className="text-title font-semibold" style={{ color: "var(--color-text)", textWrap: "balance" }}>
            Somebody in there thinks they watch the most. Prove them wrong.
          </p>
        )}
      </motion.div>

      {children && <div className="relative mt-8 flex w-full max-w-sm flex-col gap-3">{children}</div>}
    </section>
  );
}

/** Three concrete steps to the quick export, under the invite CTA. */
export function NetflixFileSteps() {
  return (
    <div className="text-left">
      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        Getting your Netflix file
      </p>
      <ol className="mt-2 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {NETFLIX_FILE_STEPS.map((step, i) => (
          <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-x-2 py-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            <span className="font-semibold tabular-nums" style={{ color: "var(--color-muted)" }}>
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * In-app browsers (Instagram, WhatsApp...) can't hand over the Netflix file: show the code big,
 * say where to open the link, and copy it in one tap. Shown to invitees, so the code is labelled
 * as the friend's; pass `heading` if the viewer owns the code.
 */
export function InAppInvite({ code, heading = "Your friend's code" }: { code: string; heading?: string }) {
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const shown = displayInviteCode(code);

  async function copyLink() {
    const url = inviteUrl(code);
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        ok = true;
      }
    } catch {
      ok = false;
    }
    setStatus(
      ok
        ? { ok: true, text: "Link copied. Paste it into Safari or Chrome." }
        : { ok: false, text: `Couldn't copy. Open Safari or Chrome and type the code: ${shown}` }
    );
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), 5000);
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm font-semibold uppercase" style={{ letterSpacing: "0.1em", color: "var(--color-muted)" }}>
        {heading}
      </p>
      <p className="font-mono font-semibold select-all text-headline tracking-[0.2em]" style={{ color: "var(--color-text)" }}>
        {shown}
      </p>
      <p style={{ color: "var(--color-text-secondary)" }}>{IN_APP_OPEN_LINE}</p>
      <button type="button" onClick={copyLink} className="btn-primary w-full px-6 py-3">
        {status?.ok ? <CheckIcon /> : <CopyIcon />}
        {status?.ok ? "Link copied" : "Copy the invite link"}
      </button>
      <p
        aria-live="polite"
        role={status && !status.ok ? "alert" : undefined}
        className="text-sm min-h-[1.25rem]"
        style={{ color: status && !status.ok ? "var(--color-red-text)" : "var(--color-text-secondary)" }}
      >
        {status?.text ?? ""}
      </p>
    </div>
  );
}
