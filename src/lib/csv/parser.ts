import Papa from "papaparse";
import type { NetflixEntry } from "@/types";

// Full data request export (CONTENT_INTERACTION/ViewingActivity.csv)
const FULL_HEADERS = ["Title", "Start Time", "Duration"];
// Quick export from netflix.com/viewingactivity (NetflixViewingHistory.csv)
const SIMPLE_HEADERS = ["Title", "Date"];

// The simple export has no durations, so estimate them
const EPISODE_SECONDS = 40 * 60;
const MOVIE_SECONDS = 110 * 60;
const EPISODE_PATTERN = /\b(season|episode|chapter|part|volume|series|collection)\b/i;

export class CSVParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CSVParseError";
  }
}

function parseDuration(raw: string): number {
  // Format: HH:MM:SS
  const parts = raw.split(":").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return 0;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

type DateOrder = "MDY" | "DMY";

// Netflix formats simple-export dates by account locale: M/D/YY (US) or D/M/YY.
// If any first component exceeds 12, the file must be day-first.
function detectDateOrder(dates: string[]): DateOrder {
  for (const raw of dates) {
    const m = raw.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}$/);
    if (m && Number(m[1]) > 12) return "DMY";
  }
  return "MDY";
}

function parseSimpleDate(raw: string, order: DateOrder): Date | null {
  const s = raw.trim();

  // ISO: YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return makeDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return null;
  const [a, b] = [Number(m[1]), Number(m[2])];
  let year = Number(m[3]);
  if (m[3].length === 2) year += 2000;
  return order === "MDY" ? makeDate(year, a, b) : makeDate(year, b, a);
}

function makeDate(year: number, month: number, day: number): Date | null {
  // Noon local time so timezone shifts never move the entry to another day
  const d = new Date(year, month - 1, day, 12);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

function showName(title: string): string {
  return title.split(":")[0].trim();
}

/**
 * The full data request logs Start Time in UTC ("2024-03-16 01:00:00", no zone). Read it as UTC so
 * getHours() reports the viewer's own local hour; reading it as local time shifted every hour stat
 * by the browser's UTC offset. Strings that already carry a zone are left to Date.
 */
function parseUtcStartTime(raw: string): Date {
  const value = raw.trim();
  const naive = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value);
  return new Date(naive ? `${value.replace(" ", "T")}Z` : value);
}

function parseFull(rows: Record<string, string>[]): NetflixEntry[] {
  return rows
    .map((row): NetflixEntry | null => {
      const startTime = parseUtcStartTime(row["Start Time"] ?? "");
      const durationSeconds = parseDuration(row["Duration"] ?? "");

      if (isNaN(startTime.getTime()) || durationSeconds === 0) return null;

      return {
        profileName: row["Profile Name"] ?? "",
        title: row["Title"] ?? "",
        startTime,
        durationSeconds,
        deviceType: row["Device Type"] ?? "",
        supplementalVideoType: row["Supplemental Video Type"] ?? "",
        country: (row["Country"] ?? "").trim() || undefined,
      } satisfies NetflixEntry;
    })
    .filter((e): e is NetflixEntry => e !== null);
}

function parseSimple(rows: Record<string, string>[]): NetflixEntry[] {
  const order = detectDateOrder(rows.map((r) => r["Date"] ?? ""));

  // A show name seen more than once is a series, so its titles are episodes
  const showCounts = new Map<string, number>();
  for (const row of rows) {
    const show = showName(row["Title"] ?? "");
    showCounts.set(show, (showCounts.get(show) ?? 0) + 1);
  }

  return rows
    .map((row): NetflixEntry | null => {
      const title = (row["Title"] ?? "").replace(/\s+/g, " ").trim();
      const startTime = parseSimpleDate(row["Date"] ?? "", order);
      if (!title || !startTime) return null;

      const isEpisode =
        EPISODE_PATTERN.test(title) || (showCounts.get(showName(row["Title"] ?? "")) ?? 0) > 1;

      return {
        profileName: "",
        title,
        startTime,
        durationSeconds: isEpisode ? EPISODE_SECONDS : MOVIE_SECONDS,
        deviceType: "",
        supplementalVideoType: "",
        timeEstimated: true,
      };
    })
    .filter((e): e is NetflixEntry => e !== null);
}

export function parseNetflixCSV(csvText: string): NetflixEntry[] {
  const result = Papa.parse<Record<string, string>>(csvText.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  }) as Papa.ParseResult<Record<string, string>>;

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new CSVParseError("Failed to parse CSV file.");
  }

  const headers = result.meta.fields ?? Object.keys(result.data[0] ?? {});
  const hasAll = (required: string[]) => required.every((h) => headers.includes(h));

  if (hasAll(FULL_HEADERS)) return parseFull(result.data);
  if (hasAll(SIMPLE_HEADERS)) return parseSimple(result.data);

  throw new CSVParseError(
    `Invalid Netflix CSV. Expected columns "Title, Date" or "Title, Start Time, Duration". ` +
      `Download your history from netflix.com/viewingactivity ("Download all"), ` +
      `or from Account > Security & Privacy > Download your personal information.`
  );
}
