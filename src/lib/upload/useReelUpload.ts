"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseNetflixCSV, CSVParseError } from "@/lib/csv/parser";
import { computeWrappedStats } from "@/lib/csv/stats";
import { adoptJoinParam, useAutoplayedStore } from "@/lib/store";
import { isValidInviteCode, normalizeInviteCode } from "@/lib/supabase/groups";

export type ReelUploadState = "idle" | "dragging" | "parsing" | "error";

/** Why a file was turned away; each kind carries its own recovery line. */
export type ReelFileErrorKind = "not-csv" | "zip" | "too-big" | "wrong-columns" | "empty" | "unreadable";

export type ReelFileError = { kind: ReelFileErrorKind; message: string; recovery: string };

const MAX_BYTES = 50 * 1024 * 1024;
const CSV_NAME = /\.csv$/i;
const ZIP_NAME = /\.zip$/i;

/** Marks every drop zone so the window-level guard lets drops land there. */
export const DROPZONE_ATTR = "data-reel-dropzone";

// Copy about the file never says "upload": the file is read here and never leaves the browser.
const ERRORS: Record<ReelFileErrorKind, Omit<ReelFileError, "kind">> = {
  "not-csv": {
    message: "That's not a CSV. Pick the file from Download all.",
    recovery: "It's called NetflixViewingHistory.csv and saves when you hit Download all at the bottom of netflix.com/viewingactivity.",
  },
  zip: {
    message: "That's the whole data-request zip.",
    recovery: "Unzip it first, then pick CONTENT_INTERACTION/ViewingActivity.csv from inside.",
  },
  "too-big": {
    message: "That file is over 50MB, so it isn't a Netflix history.",
    recovery: "Netflix's export is usually well under 5MB. Pick NetflixViewingHistory.csv instead.",
  },
  "wrong-columns": {
    message: "That CSV isn't a Netflix viewing history.",
    recovery: "Netflix's file has Title and Date columns. Pick NetflixViewingHistory.csv, or ViewingActivity.csv from a data request.",
  },
  empty: {
    message: "That file has no watch history in it.",
    recovery: "Netflix exports one profile at a time. Switch to the profile that does the watching, then Download all again.",
  },
  unreadable: {
    message: "That file couldn't be read.",
    recovery: "It may be cut off. Download it again from netflix.com/viewingactivity and pick the fresh copy.",
  },
};

function fileError(kind: ReelFileErrorKind): ReelFileError {
  return { kind, ...ERRORS[kind] };
}

function generateSessionId() {
  return Math.random().toString(36).slice(2, 10);
}

/** A valid `join` code from the current URL, lowercased like stored codes; null when absent or malformed. */
function readJoinParam(): string | null {
  if (typeof window === "undefined") return null;
  const code = normalizeInviteCode(new URLSearchParams(window.location.search).get("join"));
  return isValidInviteCode(code) ? code : null;
}

function hasFiles(e: DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

/**
 * Shared file-to-reel flow for every drop zone (landing hero, closing call, /upload).
 * The CSV is parsed and summarised in the browser; only the computed stats reach the store.
 * A `join` invite in the URL is adopted on mount and carried into the reel URL.
 */
export function useReelUpload() {
  const [state, setState] = useState<ReelUploadState>("idle");
  const [error, setError] = useState<ReelFileError | null>(null);
  // Non-error note about the drop itself, e.g. which file of several was used.
  const [notice, setNotice] = useState<string | null>(null);
  // Set synchronously when a file starts parsing, so a second drop or pick in the meantime is ignored.
  const parsingRef = useRef(false);
  const router = useRouter();
  const setWrapped = useAutoplayedStore((s) => s.setWrapped);

  // Restore a pending invite from ?join=CODE (the store validates it again)
  useEffect(() => {
    const code = readJoinParam();
    if (code) adoptJoinParam(code);
  }, []);

  // A near-miss drop outside the zone must not make the browser open the file and leave the page
  useEffect(() => {
    const guard = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      const inZone = e.target instanceof Element && e.target.closest(`[${DROPZONE_ATTR}]`);
      if (!inZone && e.type === "dragover" && e.dataTransfer) e.dataTransfer.dropEffect = "none";
    };
    window.addEventListener("dragover", guard);
    window.addEventListener("drop", guard);
    return () => {
      window.removeEventListener("dragover", guard);
      window.removeEventListener("drop", guard);
    };
  }, []);

  const fail = useCallback((kind: ReelFileErrorKind) => {
    parsingRef.current = false;
    setError(fileError(kind));
    setState("error");
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      if (parsingRef.current) return;
      if (ZIP_NAME.test(file.name)) return fail("zip");
      if (!CSV_NAME.test(file.name)) return fail("not-csv");
      if (file.size > MAX_BYTES) return fail("too-big");
      if (file.size === 0) return fail("empty");

      parsingRef.current = true;
      setState("parsing");
      setError(null);
      try {
        const text = await file.text();
        const entries = parseNetflixCSV(text);
        if (entries.length === 0) return fail("empty");
        const stats = computeWrappedStats(entries);
        const sessionId = generateSessionId();
        setWrapped(stats, sessionId);
        const join = readJoinParam();
        router.push(`/wrapped/${sessionId}${join ? `?join=${encodeURIComponent(join)}` : ""}`);
      } catch (err) {
        // The parser's header check is the only CSVParseError that means "wrong file"
        const wrongColumns = err instanceof CSVParseError && err.message.startsWith("Invalid Netflix CSV");
        fail(wrongColumns ? "wrong-columns" : "unreadable");
      }
    },
    [fail, router, setWrapped]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      // One file at a time: a drop while the last one is still being read is ignored.
      if (parsingRef.current) return;
      setState("idle");
      const files = e.dataTransfer.files;
      const file = files[0];
      setNotice(file && files.length > 1 ? `Using the first file: ${file.name}` : null);
      if (file) processFile(file);
    },
    [processFile]
  );

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState((s) => (s === "parsing" ? s : "dragging"));
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = parsingRef.current ? "none" : "copy";
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    // Ignore leave events fired when the pointer moves onto a child of the drop zone
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setState((s) => (s === "dragging" ? "idle" : s));
  }, []);

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset so picking the same file again (e.g. after an error) still fires onChange
      e.target.value = "";
      setNotice(null);
      if (file) processFile(file);
    },
    [processFile]
  );

  return {
    state,
    error,
    notice,
    dragging: state === "dragging",
    parsing: state === "parsing",
    processFile,
    onFileInput,
    dropHandlers: { [DROPZONE_ATTR]: "", onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}

/** The one label for the parsing state, shared by every entry point. */
export const PARSING_LABEL = "Building your reel…";
