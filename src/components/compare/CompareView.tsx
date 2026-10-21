"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { Group } from "@/types";
import InviteActions from "@/components/groups/InviteActions";
import InviteCodeChip from "@/components/groups/InviteCodeChip";
import AppNav from "@/components/AppNav";
import { JOIN_ACTIONS } from "@/lib/copy/invite";
import { ArrowRightIcon, CheckIcon } from "@/components/groups/icons";
import Approx from "./Approx";
import BackLink from "./BackLink";
import CompareShare from "./CompareShare";
import { StandingsList, YouTag } from "./StandingRow";
import { unitLabel, type Comparison } from "./compareModel";

// UI surfaces use the out-expo ease; the spring overshoot belongs to reel slides only
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function CompareView({
  group,
  comparison,
  ownedByMe = false,
  justJoined = false,
}: {
  group: Group;
  comparison: Comparison;
  ownedByMe?: boolean;
  /** Arrived straight from joining: a one-time welcome sits above the hero */
  justJoined?: boolean;
}) {
  const reduce = useReducedMotion();
  const { metric, ranked, leader, me, headline, punchline, superlatives, nightOwlNote } = comparison;
  // The owner who never added their own reel: adding it is the page's one red action
  const ownerOffBoard = !me && ownedByMe;
  const groupHref = `/groups/${encodeURIComponent(group.id)}`;

  return (
    <>
    <AppNav secondary={{ href: "/groups", label: "Your groups" }} />
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-16 pt-3 sm:px-6">
      <BackLink groupId={group.id} label={group.name} />

      <section aria-labelledby="h2h-heading" className="mt-6">
        {justJoined && (
          <motion.p
            role="status"
            className="mb-6 flex items-center gap-3 font-semibold text-[var(--color-text)]"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
          >
            <span
              aria-hidden="true"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--color-success) 18%, transparent)", color: "var(--color-success)" }}
            >
              <CheckIcon size={16} />
            </span>
            You&apos;re in.
          </motion.p>
        )}

        {/* The h1 comes first in the DOM so headings and screen readers start with the verdict;
            visually the kicker and hero still sit above it (flex order), so the headline never
            spoils the number for sighted viewers */}
        <div className="flex flex-col">
          <h1 id="h2h-heading" className="text-headline order-2 mt-6 font-bold" style={{ textWrap: "balance" }}>
            {headline}
          </h1>
          <div className="relative order-1 flex flex-col items-center py-6 text-center">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[-1rem] inset-y-[-2rem]"
              style={{ background: "var(--glow-hero)" }}
            />
            <p className="relative text-sm font-medium text-[var(--color-text-secondary)]">
              {me ? "Where you rank" : "Who watched the most"}
            </p>
            <motion.p
              className="slide-hero relative mt-4 font-black tabular-nums text-[var(--color-text)]"
              initial={reduce ? false : { opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
            >
              {me ? (
                <>
                  #{me.rank}
                  <span className="slide-hero-unit text-[var(--color-text-secondary)]"> of {ranked.length}</span>
                </>
              ) : (
                leader.value.toLocaleString()
              )}
            </motion.p>
            {!me && (
              <p className="text-title relative mt-3 text-[var(--color-text-secondary)]">
                {unitLabel(metric, leader.value)} for {leader.member.nickname}
              </p>
            )}
          </div>
        </div>
        <p className="text-title mt-3 text-[var(--color-text-secondary)]">{punchline}</p>

        <div className="mt-8 flex flex-col gap-3">
          {ownerOffBoard && (
            <Link href={`${groupHref}?add=1`} className="btn-primary w-full px-6 py-3">
              {JOIN_ACTIONS.addReel}
              <ArrowRightIcon />
            </Link>
          )}
          {/* Otherwise the page's one red action: the standings are made to be screenshotted */}
          <CompareShare group={group} comparison={comparison} ownedByMe={ownedByMe} primary={!ownerOffBoard} />
          <p className="-mt-2 text-sm text-[var(--color-text-secondary)]">
            Sends the head-to-head card with your invite code on it, so whoever sees it can join.
          </p>
        </div>
      </section>

      <section aria-labelledby="standings-heading" className="mt-14">
        <h2 id="standings-heading" className="text-title mb-2 font-semibold">
          The standings
        </h2>
        <StandingsList ranked={ranked} metric={metric} />
      </section>

      {superlatives.length > 0 && (
        <section aria-labelledby="awards-heading" className="mt-14">
          <h2 id="awards-heading" className="text-title font-semibold">
            Awards nobody asked for
          </h2>
          <ul className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {superlatives.map((s) => (
              <li key={s.key} className="flex min-h-11 flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <h3 className="text-sm text-[var(--color-muted)]">{s.label}</h3>
                <div className="sm:text-right">
                  <p className="font-semibold">
                    {s.name}
                    {s.isMe && <YouTag />}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    <Approx text={s.detail} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {nightOwlNote && <p className="mt-3 text-xs text-[var(--color-muted)]">{nightOwlNote}</p>}
        </section>
      )}

      <section aria-labelledby="invite-more-heading" className="mt-14">
        <h2 id="invite-more-heading" className="text-title font-semibold">
          Invite more
        </h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-text-secondary)]">
          More people, more roasts. The card above already carries the code, or send it on its own.
        </p>
        <div className="mb-4">
          <InviteCodeChip code={group.invite_code} />
        </div>
        <InviteActions code={group.invite_code} groupName={group.name} ownedByMe={ownedByMe} copyOnly />
      </section>
    </main>
    </>
  );
}
