import type { ReactNode } from "react";
import { ExternalIcon, FileIcon, LockIcon } from "./icons";

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

function FileArtifact() {
  return (
    <div
      className="w-full rounded-[12px] p-4"
      style={{ background: "var(--color-surface-2)", border: "1px dashed var(--color-border-strong)" }}
    >
      <div className="flex items-center gap-3">
        <span style={{ color: "var(--color-text-secondary)" }}>
          <FileIcon size={22} />
        </span>
        <span className="min-w-0 truncate text-sm" style={{ ...mono, color: "var(--color-text)" }}>
          NetflixViewingHistory.csv
        </span>
      </div>
      <div
        className="mt-3 flex items-center gap-2 border-t pt-3 text-sm font-semibold"
        style={{ borderColor: "var(--color-border)", color: "var(--color-success)" }}
      >
        <LockIcon size={16} />
        Read on this device. Never uploaded.
      </div>
    </div>
  );
}

function ReelArtifact() {
  // Shows what the hero reel does not: an estimated stat with its "~" marker, and the personality frame
  const frames = [
    { label: "Watch time", value: "~4,046h", kind: "number" },
    { label: "Personality", value: "Binge Lord", kind: "word" },
  ];
  return (
    <div className="w-full">
      <div className="flex items-end justify-center gap-3" aria-hidden="true">
        {frames.map((f, i) => (
          <div
            key={f.label}
            className="flex aspect-[9/16] w-[40%] max-w-28 flex-col items-center justify-center rounded-[12px] px-2 text-center"
            style={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              transform: i === 1 ? "translateY(-10px)" : undefined,
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
        It&apos;s read on your device. Only the computed stats are kept, and they reach our server only if you join
        a group.
      </>
    ),
    artifact: <FileArtifact />,
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
        sign-in and share your stats, never your file.
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
