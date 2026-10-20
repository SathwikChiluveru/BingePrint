"use client";

import { PARSING_LABEL, useReelUpload } from "@/lib/upload/useReelUpload";
import { FileIcon, LockIcon } from "./icons";

const mono = { fontFamily: "var(--font-mono)" } as const;

/**
 * How it works, step 2: a real drop target, not a picture of one.
 * Same hook as /upload, so a drop or pick builds the reel in the browser and routes to /wrapped/{id},
 * and while the landing is mounted the hook's window guard keeps a near-miss drop from opening the file.
 * The button stays secondary: the landing's red belongs to the hero and the closing call.
 */
export function LandingDropZone() {
  const { state, error, notice, dragging, parsing, onFileInput, dropHandlers } = useReelUpload();

  return (
    <div className="w-full">
      <label
        htmlFor="landing-csv-input"
        className="group block w-full cursor-pointer rounded-[12px] p-4 transition-colors focus-within:outline-2 focus-within:outline-offset-4"
        style={{
          background: dragging ? "var(--color-red-subtle)" : "var(--color-surface-2)",
          border: `1px dashed ${dragging ? "var(--color-red)" : "var(--color-border-strong)"}`,
          outlineColor: "var(--color-focus)",
        }}
        {...dropHandlers}
      >
        <span className="flex items-center gap-3">
          <span style={{ color: dragging ? "var(--color-red-text)" : "var(--color-text-secondary)" }}>
            <FileIcon size={22} />
          </span>
          <span className="min-w-0 text-sm" style={{ color: "var(--color-text)" }}>
            {parsing ? (
              <span role="status" className="font-semibold">
                {PARSING_LABEL}
              </span>
            ) : dragging ? (
              <span className="font-semibold">Let go to build your reel</span>
            ) : (
              <>
                {/* Touch screens can't drop a file: CSS picks the verb by input type, so markup matches SSR */}
                <span className="pointer-coarse:hidden">Drop </span>
                <span className="hidden pointer-coarse:inline">Pick </span>
                <span className="[overflow-wrap:anywhere]" style={mono}>
                  NetflixViewingHistory.csv
                </span>
              </>
            )}
          </span>
        </span>
        <span
          className="btn-secondary mt-3 w-full px-4 text-sm group-hover:border-[var(--color-border-strong)]"
          style={{ background: "var(--color-surface-3)" }}
          aria-hidden={parsing || undefined}
        >
          Choose file
        </span>
        <input
          id="landing-csv-input"
          aria-label="Choose NetflixViewingHistory.csv"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={parsing}
          onChange={onFileInput}
          aria-describedby={state === "error" ? "landing-file-error" : "landing-file-note"}
        />
        <span
          id="landing-file-note"
          className="mt-3 flex items-center gap-2 border-t pt-3 text-sm font-semibold"
          style={{ borderColor: "var(--color-border)", color: "var(--color-success)" }}
        >
          <LockIcon size={16} />
          Read on this device. Never uploaded.
        </span>
      </label>

      {notice && (
        <p role="status" className="mt-2 text-xs break-words" style={{ color: "var(--color-text-secondary)" }}>
          {notice}
        </p>
      )}

      {state === "error" && error && (
        <div
          id="landing-file-error"
          role="alert"
          className="mt-3 rounded-[12px] p-3 text-sm"
          style={{
            background: "var(--color-red-subtle)",
            color: "var(--color-red-text)",
            border: "1px solid var(--color-red-border)",
          }}
        >
          <p className="font-semibold">{error.message}</p>
          <p className="mt-1" style={{ color: "var(--color-text-secondary)" }}>
            {error.recovery}
          </p>
        </div>
      )}
    </div>
  );
}
