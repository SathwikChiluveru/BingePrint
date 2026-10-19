"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { isPendingInviteFresh, useAutoplayedStore } from "@/lib/store";
import { PARSING_LABEL, useReelUpload } from "@/lib/upload/useReelUpload";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M12 17v-6M9 13.5l3-3 3 3" />
    </svg>
  );
}

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
      <main
        className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
        style={{ background: "var(--color-bg)" }}
      >
        <motion.div
          className="w-full max-w-xl"
          initial={{ y: 16 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
        >
          <div className="mb-8 text-center">
            <Link
              href="/"
              className="text-3xl font-black"
              style={{ color: "var(--color-text)", letterSpacing: "-0.02em" }}
            >
              Autoplayed
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold mt-3" style={{ letterSpacing: "-0.02em" }}>
              Hand over the evidence
            </h1>
            {pendingInvite && (
              <p className="mt-2 font-semibold">
                Pick your history file to see how you stack up against {pendingInvite.groupName ?? "your group"}.
              </p>
            )}
            <p className="mt-2" style={{ color: "var(--color-text-secondary)" }}>
              Add your Netflix viewing history CSV. It is read in your browser and never uploaded.
            </p>
          </div>

          {/* Drop zone */}
          <AnimatePresence mode="wait" initial={false}>
            {state !== "parsing" && (
              <motion.label
                key="dropzone"
                htmlFor="csv-input"
                className="group flex flex-col items-center justify-center gap-4 rounded-2xl cursor-pointer p-12 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-4"
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
                  className="transition-colors"
                  style={{ color: dragging ? "var(--color-red)" : "var(--color-text-secondary)" }}
                >
                  <UploadIcon />
                </span>
                <span className="block">
                  {/* Touch screens can't drop a file: CSS picks the wording by input type, so markup matches SSR */}
                  <span className="block font-semibold text-lg">
                    {dragging ? (
                      "Drop to build your reel"
                    ) : (
                      <>
                        <span className="pointer-coarse:hidden">Drop your CSV here</span>
                        <span className="hidden pointer-coarse:inline">Pick your CSV</span>
                      </>
                    )}
                  </span>
                  <span className="block text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
                    <span className="pointer-coarse:hidden">or </span>
                    <span className="underline group-hover:text-white">choose a file</span> · .csv up to 50MB
                  </span>
                </span>
                <input
                  id="csv-input"
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={onFileInput}
                  aria-describedby={state === "error" ? "upload-error" : undefined}
                />
              </motion.label>
            )}

            {state === "parsing" && (
              <motion.div
                key="parsing"
                className="card flex flex-col items-center justify-center gap-4 p-12 text-center"
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

          {/* Most first-timers arrive without the file yet: point them at the steps right away */}
          {state !== "parsing" && (
            <p className="mt-3 text-center text-sm" style={{ color: "var(--color-text-secondary)" }}>
              No file yet?{" "}
              <a href="#howto-heading" className="underline" style={{ color: "var(--color-text)" }}>
                Get it from Netflix in about 30 seconds
              </a>
            </p>
          )}

          {notice && (
            <p role="status" className="mt-3 text-sm text-center break-words" style={{ color: "var(--color-text-secondary)" }}>
              {notice}
            </p>
          )}

          {state === "error" && error && (
            <motion.div
              id="upload-error"
              role="alert"
              className="mt-4 p-4 rounded-xl text-sm"
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

          {/* How to download */}
          <section
            className="mt-8 p-6 rounded-xl text-sm"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
            aria-labelledby="howto-heading"
          >
            <h2 id="howto-heading" className="text-base font-semibold">
              How to get your Netflix data
            </h2>
            <p className="mt-1" style={{ color: "var(--color-text-secondary)" }}>
              Either export works. The first is quickest.
            </p>

            <div className="mt-5">
              <h3 className="font-semibold">
                Quick: viewing activity <span style={{ color: "var(--color-muted)" }}>(about 30 seconds)</span>
              </h3>
              <ol
                className="list-decimal pl-5 mt-2 space-y-1.5 marker:text-[var(--color-muted)]"
                style={{ color: "var(--color-text-secondary)" }}
              >
                <li>
                  Sign in and open{" "}
                  <a
                    href="https://www.netflix.com/viewingactivity"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                    style={{ color: "var(--color-text)" }}
                  >
                    netflix.com/viewingactivity
                  </a>{" "}
                  (pick your profile if asked).{" "}
                  <strong style={{ color: "var(--color-text)" }}>Use a web browser, not the Netflix app:</strong>{" "}
                  the app has no download button.
                </li>
                <li>
                  Scroll to the bottom and click <strong style={{ color: "var(--color-text)" }}>Download all</strong>
                </li>
                <li>
                  Choose the file it saves: <FilePath>NetflixViewingHistory.csv</FilePath>{" "}
                  <span style={{ color: "var(--color-muted)" }}>(on a phone it lands in Files / Downloads)</span>
                </li>
              </ol>
            </div>

            <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--color-border)" }}>
              <h3 className="font-semibold">
                Full: personal data request{" "}
                <span style={{ color: "var(--color-muted)" }}>(includes watch durations)</span>
              </h3>
              <ol
                className="list-decimal pl-5 mt-2 space-y-1.5 marker:text-[var(--color-muted)]"
                style={{ color: "var(--color-text-secondary)" }}
              >
                <li>
                  On netflix.com go to Account, then Security &amp; Privacy, then{" "}
                  <strong style={{ color: "var(--color-text)" }}>Download your personal information</strong>
                </li>
                <li>Submit the request and wait for Netflix&apos;s email with the download link</li>
                <li>
                  Unzip it and choose <FilePath>CONTENT_INTERACTION/ViewingActivity.csv</FilePath>{" "}
                  <span style={{ color: "var(--color-muted)" }}>(adds time-of-day stats)</span>
                </li>
              </ol>
            </div>
          </section>

          <p className="mt-8 text-center text-xs" style={{ color: "var(--color-muted)" }}>
            Autoplayed is not affiliated with Netflix, Inc. ·{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-white">
              Privacy
            </Link>
          </p>
        </motion.div>
      </main>
    </MotionConfig>
  );
}
