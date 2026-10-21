"use client";

import Link from "next/link";
import { MotionConfig, motion } from "framer-motion";
import { SAMPLE_VERSUS } from "./sampleData";

const SMOOTH = [0.4, 0, 0.2, 1] as const;

type Member = { name: string; titles: number; bestDay: number; personality: string };

const toNumber = (value: string) => Number(value.replace(/,/g, ""));
const [YOU, ROOMMATE] = SAMPLE_VERSUS;

/** Illustrative group. "You" and "Roommate" share the sample reel's numbers; the admin is a made-up sample row. */
const MEMBERS: Member[] = [
  { name: YOU.name, titles: toNumber(YOU.value), bestDay: 51, personality: "The Binge Lord" },
  { name: ROOMMATE.name, titles: toNumber(ROOMMATE.value), bestDay: 19, personality: "The Weekend Warrior" },
  { name: "Group chat admin", titles: 3388, bestDay: 27, personality: "The Loyalist" },
];

const STATS: { label: string; key: "titles" | "bestDay"; unit: string }[] = [
  { label: "Titles watched", key: "titles", unit: "titles" },
  { label: "Biggest single day", key: "bestDay", unit: "in one day" },
];

function StatBars({ label, statKey, unit }: { label: string; statKey: "titles" | "bestDay"; unit: string }) {
  const max = Math.max(...MEMBERS.map((m) => m[statKey]));
  return (
    <div>
      <h3
        className="text-xs font-semibold uppercase"
        style={{ color: "var(--color-muted)", letterSpacing: "0.1em" }}
      >
        {label}
      </h3>
      <ul className="mt-3 space-y-3">
        {MEMBERS.map((m) => {
          const value = m[statKey];
          const leader = value === max;
          return (
            <li key={m.name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span style={{ color: leader ? "var(--color-text)" : "var(--color-text-secondary)" }}>
                  {m.name}
                </span>
                <span className="font-bold tabular-nums" style={{ color: leader ? "var(--color-text)" : "var(--color-text-secondary)" }}>
                  {value.toLocaleString("en-US")}
                  <span className="sr-only"> {unit}</span>
                </span>
              </div>
              <div
                aria-hidden="true"
                className="mt-1.5 h-2 overflow-hidden rounded-full"
                style={{ background: "var(--color-track)" }}
              >
                {/* Bars render at their true length from the first paint (a pre-scroll capture or a
                    link unfurl must never show a chart that contradicts its numbers); they only brighten in */}
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${(value / max) * 100}%`,
                    background: leader ? "var(--color-track-strong)" : "var(--color-border-strong)",
                  }}
                  initial={{ opacity: 0.45 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, margin: "0px 0px -15% 0px" }}
                  transition={{ duration: 0.6, ease: SMOOTH }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function GroupTeaser() {
  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-labelledby="group-heading"
        style={{ background: "var(--color-surface)", borderBlock: "1px solid var(--color-border)" }}
      >
        <div className="mx-auto grid w-full max-w-5xl gap-12 px-6 py-20 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-center md:gap-16 md:py-28">
          <div>
            <h2 id="group-heading" className="text-headline max-w-[16ch] font-bold">
              Somebody in your group is the Binge Lord. Find out who.
            </h2>
            <p className="mt-5 max-w-[48ch] text-lg leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              Your own reel is the warm-up. Start a group, share the 8-character invite code, and every
              friend who joins lands on the same screen, stat for stat. Nobody gets to round down.
            </p>
            {/* One quiet action: the red stays with the hero and the closing call; groups start from the reel's last slide */}
            <div className="mt-8">
              <Link href="/groups?mode=join" className="btn-secondary px-6 py-3 text-base">
                Join a friend&apos;s group
              </Link>
            </div>
            <p className="mt-3 text-sm" style={{ color: "var(--color-muted)" }}>
              Starting one?{" "}
              <Link
                href="/upload"
                className="-my-3 inline-block py-3 font-semibold underline underline-offset-4 hover:text-white"
                style={{ color: "var(--color-text)" }}
              >
                Get your reel first
              </Link>
              ; its last slide starts the group. Groups need a quick sign-in, your reel doesn&apos;t.
            </p>
          </div>

          <figure className="m-0">
            <div
              className="rounded-[16px] p-6"
              style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="space-y-7">
                {STATS.map((s) => (
                  <StatBars key={s.key} label={s.label} statKey={s.key} unit={s.unit} />
                ))}

                <div>
                  <h3
                    className="text-xs font-semibold uppercase"
                    style={{ color: "var(--color-muted)", letterSpacing: "0.1em" }}
                  >
                    Personality
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {MEMBERS.map((m) => (
                      <li key={m.name} className="flex items-baseline justify-between gap-3 text-sm">
                        <span style={{ color: "var(--color-text-secondary)" }}>{m.name}</span>
                        <span className="text-right font-semibold">{m.personality}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <p
                className="mt-7 border-t pt-5 text-base font-semibold leading-snug"
                style={{ borderColor: "var(--color-border)", textWrap: "balance" }}
              >
                The admin started this group to prove a point. The point was you.
              </p>
            </div>
            <figcaption className="mt-3 text-sm" style={{ color: "var(--color-muted)" }}>
              Sample group. Real groups show everyone who joined.
            </figcaption>
          </figure>
        </div>
      </section>
    </MotionConfig>
  );
}
