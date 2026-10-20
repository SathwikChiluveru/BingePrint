import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalIcon } from "./icons";
import { LandingDropZone } from "./LandingDropZone";

type Step = {
  title: string;
  body: ReactNode;
  artifact: ReactNode;
};

const mono = { fontFamily: "var(--font-mono)" } as const;

function ExportArtifact() {
  return (
    <a
      href="https://www.netflix.com/viewingactivity"
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-h-11 w-full items-center gap-3 rounded-[12px] px-4 py-3 transition-colors hover:border-[var(--color-border-strong)]"
      style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs" style={{ color: "var(--color-muted)" }}>
          Open in a new tab
        </span>
        <span className="block truncate text-sm" style={{ ...mono, color: "var(--color-text)" }}>
          netflix.com/viewingactivity
        </span>
      </span>
      <span style={{ color: "var(--color-text-secondary)" }} className="transition-colors group-hover:text-white">
        <ExternalIcon />
      </span>
    </a>
  );
}

function ReelArtifact() {
  // Frames the hero reel never shows: estimated watch time (with its "~") and the busiest weekday.
  // True 9:16 sample frames at the sample-slide radius; one faint glow sits behind the active frame only.
  const frames = [
    { label: "Watch time", value: "~4,046h", kind: "number", active: true },
    { label: "Your week", value: "Sundays", kind: "word", active: false },
  ];
  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-3" aria-hidden="true">
        {frames.map((f) => (
          <div key={f.label} className="relative isolate w-[46%] max-w-[7.5rem]">
            {f.active && (
              <div
                className="pointer-events-none absolute inset-[-45%] -z-10 opacity-70"
                style={{ background: "var(--glow-hero)" }}
              />
            )}
            <div
              className="flex aspect-[9/16] w-full flex-col items-center justify-center rounded-[24px] px-2 text-center"
              style={{
                background: f.active ? "var(--color-bg)" : "var(--color-surface)",
                border: `1px solid ${f.active ? "var(--color-border-strong)" : "var(--color-border)"}`,
                opacity: f.active ? 1 : 0.7,
                transform: f.active ? undefined : "scale(0.9)",
              }}
            >
              <span
                className="text-xs font-semibold uppercase"
                style={{ color: "var(--color-muted)", letterSpacing: "0.1em" }}
              >
                {f.label}
              </span>
              <span
                className={`mt-1 font-black ${f.kind === "number" ? "text-xl tabular-nums" : "text-lg leading-tight"}`}
                style={{ letterSpacing: "-0.03em" }}
              >
                {f.value}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs" style={{ color: "var(--color-muted)" }}>
        Sample frames. A ~ means estimated: the quick export has no durations.
      </p>
    </div>
  );
}


function InviteArtifact() {
  // One mono chip reads as a code to share; per-character boxes would read as an input to fill in
  return (
    <div className="w-full">
      <span
        className="inline-flex min-h-11 items-center rounded-[6px] px-4 text-lg font-semibold"
        style={{
          ...mono,
          letterSpacing: "0.2em",
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
        }}
      >
        K7QM2XPA
      </span>
      <p className="mt-2 text-xs" style={{ color: "var(--color-muted)" }}>
        Sample invite code. Paste yours in the group chat.
      </p>
    </div>
  );
}

const steps: Step[] = [
  {
    title: "Export your history",
    body: (
      <>
        Hit <strong className="font-semibold text-white">Download all</strong> at the bottom of
        netflix.com/viewingactivity. Use a browser, not the app. About 30 seconds.
      </>
    ),
    artifact: <ExportArtifact />,
  },
  {
    title: "Add the file",
    body: (
      <>
        Add it right here. It&apos;s read on your device; only the computed stats are kept, and they
        reach our server only if you join a group.{" "}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-white" style={{ color: "var(--color-text)" }}>
          What&apos;s kept, exactly
        </Link>
      </>
    ),
    artifact: <LandingDropZone />,
  },
  {
    title: "Sit through your reel",
    body: (
      <>
        Up to ten slides of evidence: watch time, top shows, longest binge, and a personality label you will want to
        dispute.
      </>
    ),
    artifact: <ReelArtifact />,
  },
  {
    title: "Challenge your group",
    body: (
      <>
        Start a group and drop the code in the chat. Everyone&apos;s stats land side by side. Groups need a quick
        sign-in. The group sees your name, stats and personality, never the file.
      </>
    ),
    artifact: <InviteArtifact />,
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="mx-auto w-full max-w-5xl px-6 py-20 md:py-28">
      <h2 id="how-heading" className="text-headline max-w-[22ch] font-bold">
        Four steps. One of them is admitting how much you watch.
      </h2>

      <ol className="mt-10 md:mt-14" style={{ borderTop: "1px solid var(--color-border)" }}>
        {steps.map((step, i) => (
          <li
            key={step.title}
            className="grid gap-6 py-8 md:grid-cols-[3rem_minmax(0,1fr)_18rem] md:items-center md:gap-10 md:py-10"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <span
              aria-hidden="true"
              className="text-3xl font-black tabular-nums"
              style={{ color: "var(--color-muted)", letterSpacing: "-0.03em", lineHeight: 1 }}
            >
              {i + 1}
            </span>
            <div className="-mt-4 md:mt-0">
              <h3 className="text-title font-semibold">{step.title}</h3>
              <p className="mt-2 max-w-[56ch] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                {step.body}
              </p>
            </div>
            <div className="flex">{step.artifact}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
