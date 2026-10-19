// Synthetic Netflix exports for integration tests. Every title and profile here is made up.
import { parseNetflixCSV } from "@/lib/csv/parser";
import { computeWrappedStats } from "@/lib/csv/stats";
import type { WrappedStats } from "@/types";

const TIMED_HEADER =
  "Profile Name,Start Time,Duration,Attributes,Title,Supplemental Video Type,Device Type,Bookmark,Latest Bookmark,Country";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function timedRow(title: string, start: Date, minutes: number, supplemental = "") {
  const ts = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} ${pad(start.getHours())}:${pad(start.getMinutes())}:00`;
  const dur = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;
  return `Tester,${ts},${dur},,"${title}",${supplemental},Synthetic TV,${dur},${dur},US (United States)`;
}

/**
 * Timed export (ViewingActivity.csv shape): a late-night binge of a fake series, a few day-time
 * movies, one resumed episode (same title, same day, two rows) and one trailer that must be ignored.
 */
export function timedCsv(): string {
  const rows: string[] = [TIMED_HEADER];
  // Five episodes back to back, starting 22:00 on 2024-03-01
  for (let ep = 1; ep <= 5; ep++) {
    rows.push(timedRow(`Fake Orbit: Season 1: Episode ${ep}`, new Date(2024, 2, 1, 22, (ep - 1) * 50), 45));
  }
  // Episode 5 starts 01:20 on 03-02; resumed later that day: a second row for one title+day pair
  rows.push(timedRow("Fake Orbit: Season 1: Episode 5", new Date(2024, 2, 2, 2, 30), 10));
  // Weekend movies
  rows.push(timedRow("Paper Lantern Heist", new Date(2024, 2, 2, 14, 0), 110));
  rows.push(timedRow("Paper Lantern Heist", new Date(2024, 2, 9, 15, 0), 108));
  rows.push(timedRow("Quiet Harbor", new Date(2024, 2, 3, 20, 30), 95));
  // More series on later days
  for (let ep = 1; ep <= 3; ep++) {
    rows.push(timedRow(`Velvet Desk: Season 2: Episode ${ep}`, new Date(2024, 2, 5 + ep, 1, 15), 30));
  }
  // Trailer: supplemental video, dropped by the stats
  rows.push(timedRow("Fake Orbit: Season 2 (Trailer)", new Date(2024, 2, 4, 12, 0), 2, "TRAILER"));
  return rows.join("\n");
}

/** Quick export (NetflixViewingHistory.csv shape): dates only, US M/D/YY order. */
export function dateOnlyCsv(): string {
  const rows = ["Title,Date"];
  for (let ep = 1; ep <= 8; ep++) rows.push(`"Moss Kingdom: Season 1: Chapter ${ep}","3/${ep}/24"`);
  for (let ep = 9; ep <= 12; ep++) rows.push(`"Moss Kingdom: Season 1: Chapter ${ep}","3/9/24"`);
  rows.push(`"Tin Comet","3/10/24"`);
  rows.push(`"Glass Orchard: Limited Series: Part 1","3/11/24"`);
  rows.push(`"Glass Orchard: Limited Series: Part 2","3/11/24"`);
  return rows.join("\n");
}

/** A valid header with no rows: parses to zero entries (an empty history). */
export function emptyCsv(): string {
  return "Title,Date\n";
}

export function statsFrom(csv: string): WrappedStats {
  return computeWrappedStats(parseNetflixCSV(csv));
}

/** What a browser sends: Dates become ISO strings over JSON. */
export function overTheWire<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

/** A hand-built empty history (as computeWrappedStats would make for zero entries). */
export function emptyStats(): WrappedStats {
  return computeWrappedStats([]);
}
