"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { isPendingInviteFresh, useAutoplayedStore } from "@/lib/store";
import { PARSING_LABEL, useReelUpload } from "@/lib/upload/useReelUpload";
import { ExternalIcon, FileIcon, LockIcon } from "@/components/landing/icons";
import AppNav from "@/components/AppNav";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const mono = { fontFamily: "var(--font-mono)" } as const;

function Spinner() {
  return (
    <motion.svg
      aria-hidden="true"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
    >
      <circle cx="12" cy="12" r="9" stroke="var(--color-surface-3)" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="var(--color-red)" strokeWidth="2.5" strokeLinecap="round" />
    </motion.svg>
  );
}

function FilePath({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="px-1.5 py-0.5 text-xs break-all"
      style={{ background: "var(--color-surface-3)", color: "var(--color-text)", borderRadius: "var(--radius-sm)" }}
    >
      {children}
    </code>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
      style={{ background: "var(--color-surface-3)", color: "var(--color-text)" }}
    >
      {n}
    </span>
  );
}

export default function UploadPage() {
  const { state, error, notice, dragging, onFileInput, dropHandlers } = useReelUpload();
  const storedInvite = useAutoplayedStore((s) => s.pendingInvite);
  const setPendingInvite = useAutoplayedStore((s) => s.setPendingInvite);
  // The invite lives in localStorage, so only show it after hydration to keep server and client markup equal
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  // Expired invites are ignored here and cleared below so they stop steering the reel
  const pendingInvite = isClient && isPendingInviteFresh(storedInvite) ? storedInvite : null;
  useEffect(() => {
    if (storedInvite && !isPendingInviteFresh(storedInvite)) setPendingInvite(null);
  }, [storedInvite, setPendingInvite]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col overflow-x-clip" style={{ background: "var(--color-bg)" }}>
        {/* Same thin bar as the landing; the wordmark is white here so the page's one red thing is the file action */}
        <AppNav secondary={{ href: "/", label: "Back" }} />

        <main className="flex flex-1 flex-col px-6 pb-12 pt-6 md:pt-14">
          <motion.div
            className="mx-auto w-full max-w-xl"
            initial={{ y: 16 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
          >
            <h1 className="text-headline font-bold">Hand over the evidence</h1>
            {pendingInvite && (
              <p className="mt-2 font-semibold">
                Pick your history file to see how you stack up against {pendingInvite.groupName ?? "your group"}.
              </p>
            )}
            <p className="mt-2 flex items-start gap-2" style={{ color: "var(--color-text-secondary)" }}>
              <span className="mt-1 shrink-0" style={{ color: "var(--color-success)" }}>
                <LockIcon size={16} />
              </span>
              <span>Your Netflix viewing history is read in this browser and never uploaded.</span>
            </p>

            <div className="mt-6">
              <AnimatePresence mode="wait" initial={false}>
                {state !== "parsing" && (
                  <motion.label
                    key="dropzone"
                    htmlFor="csv-input"
                    className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl p-5 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-4 sm:gap-4 sm:p-10"
                    style={{
                      border: `2px dashed ${dragging ? "var(--color-red)" : "var(--color-border-strong)"}`,
                      background: dragging ? "var(--color-red-subtle)" : "var(--color-surface)",
                      outlineColor: "var(--color-focus)",
                    }}
                    {...dropHandlers}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, scale: dragging ? 1.015 : 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                  >
                    <span
                      className="hidden transition-colors sm:block"
                      style={{ color: dragging ? "var(--color-red-text)" : "var(--color-text-secondary)" }}
                    >
                      <FileIcon size={36} />
                    </span>
                    {/* Touch screens can't drop a file: CSS picks the wording by input type, so markup matches SSR */}
                    <span className="block text-base font-semibold sm:text-lg">
                      {dragging ? (
                        "Let go to build your reel"
                      ) : (
                        <>
                          <span className="pointer-coarse:hidden">Drop </span>
                          <span className="hidden pointer-coarse:inline">Pick </span>
                          <span className="[overflow-wrap:anywhere]" style={mono}>
                            NetflixViewingHistory.csv
                          </span>
                        </>
                      )}
                    </span>
                    {!dragging && (
                      <span id="upload-alt" className="-mt-2 block text-sm sm:-mt-3" style={{ color: "var(--color-muted)" }}>
                        or <span style={mono}>ViewingActivity.csv</span> from a data request
                      </span>
                    )}
                    <span className="btn-primary min-h-12 w-full px-6 text-base sm:w-auto">Choose file</span>
                    <input
                      id="csv-input"
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      onChange={onFileInput}
                      aria-describedby={state === "error" ? "upload-error" : "upload-alt upload-next"}
                    />
                  </motion.label>
                )}

                {state === "parsing" && (
                  <motion.div
                    key="parsing"
                    className="card flex flex-col items-center justify-center gap-4 p-6 text-center sm:p-12"
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Spinner />
                    <p className="font-semibold">{PARSING_LABEL}</p>
                    <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                      Read on this device. Nothing leaves your browser.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* The alert sits right under the zone and replaces the "what happens next" line while it shows */}
            {state === "error" && error && (
              <motion.div
                id="upload-error"
                role="alert"
                className="mt-3 rounded-xl p-4 text-sm"
                style={{
                  background: "var(--color-red-subtle)",
                  color: "var(--color-red-text)",
                  border: "1px solid var(--color-red-border)",
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
              >
                <p className="font-semibold">{error.message}</p>
                <p className="mt-1" style={{ color: "var(--color-text-secondary)" }}>
                  {error.recovery}
                </p>
              </motion.div>
            )}

            {state !== "error" && (
              <p id="upload-next" className="mt-3 text-center text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Your reel opens right away. No account needed.
              </p>
            )}

            {notice && (
              <p role="status" className="mt-3 text-center text-sm break-words" style={{ color: "var(--color-text-secondary)" }}>
                {notice}
              </p>
            )}

            {/* Most first-timers arrive without the file: the quick steps sit right under the zone, always visible */}
            <section
              aria-labelledby="howto-heading"
              className="mt-8 pt-6 text-sm"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <h2 id="howto-heading" className="text-base font-semibold">
                No file yet? <span style={{ color: "var(--color-text-secondary)" }}>About 30 seconds.</span>
              </h2>
              <ol className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-4" style={{ color: "var(--color-text-secondary)" }}>
                <li className="flex items-start gap-3 sm:flex-col sm:gap-2">
                  <StepNumber n={1} />
                  <span>
                    Open{" "}
                    <a
                      href="https://www.netflix.com/viewingactivity"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline underline-offset-4 hover:text-white"
                      style={{ color: "var(--color-text)" }}
                    >
                      netflix.com/viewingactivity
                      <ExternalIcon size={14} className="ml-1 inline-block align-[-2px]" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>{" "}
                    in a browser, not the app
                  </span>
                </li>
                <li className="flex items-start gap-3 sm:flex-col sm:gap-2">
                  <StepNumber n={2} />
                  <span>
                    Hit <strong style={{ color: "var(--color-text)" }}>Download all</strong> at the bottom of the page
                  </span>
                </li>
                <li className="flex items-start gap-3 sm:flex-col sm:gap-2">
                  <StepNumber n={3} />
                  <span>
                    Pick the file above.{" "}
                    <span style={{ color: "var(--color-muted)" }}>On a phone it lands in Files / Downloads.</span>
                  </span>
                </li>
              </ol>

              <details className="group mt-6 rounded-xl" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                  <span>
                    Want time-of-day stats?{" "}
                    <span className="font-normal" style={{ color: "var(--color-text-secondary)" }}>
                      Use a full data request.
                    </span>
                  </span>
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 transition-transform group-open:rotate-180"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <ol
                  className="list-decimal space-y-1.5 pb-4 pl-9 pr-4 marker:text-[var(--color-muted)]"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <li>
                    On netflix.com go to Account, then Security &amp; Privacy, then{" "}
                    <strong style={{ color: "var(--color-text)" }}>Download your personal information</strong>
                  </li>
                  <li>Submit the request and wait for Netflix&apos;s email with the download link</li>
                  <li>
                    Unzip it and pick <FilePath>CONTENT_INTERACTION/ViewingActivity.csv</FilePath>{" "}
                    <span style={{ color: "var(--color-muted)" }}>(it includes watch durations)</span>
                  </li>
                </ol>
              </details>
            </section>

            <p className="mt-10 text-center text-xs" style={{ color: "var(--color-muted)" }}>
              Autoplayed is not affiliated with Netflix, Inc. ·{" "}
              <Link href="/privacy" className="-my-3 inline-block px-1 py-3 underline underline-offset-4 hover:text-white">
                Privacy
              </Link>
            </p>
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  );
}
