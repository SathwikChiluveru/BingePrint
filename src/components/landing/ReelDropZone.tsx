"use client";

import { useId, useRef } from "react";
import Link from "next/link";
import { PARSING_LABEL, useReelUpload } from "@/lib/upload/useReelUpload";
import { ExternalIcon, FileIcon } from "./icons";
import styles from "./landing.module.css";

type Props = {
  /** "center" for the closing call; "start" for the hero column. */
  align?: "start" | "center";
  className?: string;
};

/**
 * The landing's working primary action: drop or pick the Netflix CSV right here.
 * Shares the exact parse and validation flow with /upload, which stays for deep links.
 * The whole dashed zone opens the picker; the button is its keyboard and screen-reader handle.
 */
export function ReelDropZone({ align = "start", className = "" }: Props) {
  const { state, error, dragging, parsing, onFileInput, dropHandlers } = useReelUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const centered = align === "center";

  const openPicker = () => {
    if (!parsing) inputRef.current?.click();
  };

  return (
    <div className={`w-full ${centered ? "mx-auto max-w-md text-center" : "max-w-md"} ${className}`}>
      {/* Click anywhere in the zone; keyboard users get the same action from the button (its click bubbles here) */}
      <div
        {...dropHandlers}
        onClick={openPicker}
        className={`${styles.dropzone} rounded-[16px] p-3 transition-colors sm:p-4 ${parsing ? "cursor-progress" : "cursor-pointer"}`}
        data-dragging={dragging || undefined}
      >
        <div className="flex flex-col gap-3">
          <div className={`flex min-w-0 items-center gap-3 ${centered ? "justify-center" : ""}`}>
            <span
              className="hidden shrink-0 transition-colors sm:block"
              style={{ color: dragging ? "var(--color-red-text)" : "var(--color-text-secondary)" }}
            >
              <FileIcon size={22} />
            </span>
            <p id={hintId} className="min-w-0 text-left text-sm font-semibold leading-snug" style={{ color: "var(--color-text)" }}>
              {dragging ? (
                "Let go to build your reel"
              ) : (
                <>
                  <span className="pointer-coarse:hidden">Drop your </span>
                  <span className="hidden pointer-coarse:inline">Pick your </span>
                  <span className="[overflow-wrap:anywhere]" style={{ fontFamily: "var(--font-mono)" }}>
                    NetflixViewingHistory.csv
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={parsing}
            aria-describedby={state === "error" ? `${hintId} ${errorId}` : hintId}
            className="btn-primary min-h-12 w-full px-6 text-base"
          >
            {parsing ? PARSING_LABEL : "Choose file"}
          </button>
        </div>
        {parsing && (
          <p role="status" className="sr-only">
            {PARSING_LABEL}
          </p>
        )}
      </div>
      {/* Outside the zone so its own click event never re-enters openPicker */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFileInput}
      />

      {state === "error" && error && (
        <div
          id={errorId}
          role="alert"
          className="mt-3 rounded-[12px] p-3 text-left text-sm"
          style={{
            background: "var(--color-red-subtle)",
            color: "var(--color-red-text)",
            border: "1px solid var(--color-red-border)",
          }}
        >
          <p className="font-semibold">{error.message}</p>
          <p className="mt-1" style={{ color: "var(--color-text-secondary)" }}>
            {error.recovery}{" "}
            <Link href="/upload" className="underline underline-offset-2" style={{ color: "var(--color-text)" }}>
              Step-by-step help
            </Link>
          </p>
        </div>
      )}

      {/* Inline links: vertical padding grows the hit area to 44px without stretching the line box */}
      <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
        Don&apos;t have it yet?{" "}
        <a
          href="https://www.netflix.com/viewingactivity"
          target="_blank"
          rel="noopener noreferrer"
          className="py-3 font-semibold underline underline-offset-4 hover:text-white"
          style={{ color: "var(--color-text)" }}
        >
          Open{" "}
          <span className="whitespace-nowrap">
            netflix.com/viewingactivity
            <ExternalIcon size={14} className="ml-1 inline-block align-[-2px]" />
          </span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>{" "}
        <span style={{ color: "var(--color-muted)" }}>
          (Download all, bottom of the page. On a phone it lands in Files / Downloads.)
        </span>
      </p>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
        Got <span style={{ fontFamily: "var(--font-mono)" }}>ViewingActivity.csv</span> from a data request? That
        works too, with time-of-day stats.
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Got an invite code?{" "}
        <Link
          href="/groups?mode=join"
          className="inline-block py-3 font-semibold underline underline-offset-4 hover:text-white"
          style={{ color: "var(--color-text)" }}
        >
          Join a group
        </Link>
      </p>
    </div>
  );
}
