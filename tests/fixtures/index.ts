import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NetflixEntry, WrappedStats } from "@/types";

/** Reads a synthetic CSV fixture from tests/fixtures as UTF-8 text (a BOM, if any, is kept). */
export function loadFixture(name: string): string {
  return readFileSync(join(__dirname, name), "utf8");
}

/** Builds a NetflixEntry with sensible defaults (a timed 45-minute episode). */
export function makeEntry(overrides: Partial<NetflixEntry> & { title: string; startTime: Date }): NetflixEntry {
  return {
    profileName: "Test",
    durationSeconds: 45 * 60,
    deviceType: "",
    supplementalVideoType: "",
    ...overrides,
  };
}

/** Local-time date helper: at(2024, 3, 15, 21, 30) is 15 March 2024 21:30 local. */
export function at(year: number, month: number, day: number, hour = 12, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute);
}

/** Minimal WrappedStats for model/compare tests; override what matters. */
export function makeStats(overrides: Partial<WrappedStats> = {}): WrappedStats {
  return {
    totalSeconds: 0,
    totalHours: 0,
    totalDays: 0,
    topShows: [],
    mostLoyalShow: { title: "", watchCount: 0, totalSeconds: 0 },
    longestBinge: {
      startTime: new Date(2024, 0, 1, 12),
      endTime: new Date(2024, 0, 1, 13),
      totalSeconds: 0,
      showCount: 0,
      titles: [],
      titleCount: 0,
    },
    allBingeSessions: [],
    nightOwlScore: 0,
    dayHeatmap: (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((day) => ({ day, hours: 0 })),
    personality: "The Casual Viewer",
    personalityDescription: "",
    funComparison: "",
    peakHour: 0,
    uniqueShowsCount: 0,
    totalEpisodesEstimate: 0,
    hasTimeData: true,
    ...overrides,
  };
}
