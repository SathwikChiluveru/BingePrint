import type { Insights, NetflixEntry } from "@/types";

/** title -> show name, as built by stats.ts for this history */
export type ShowNamer = (title: string) => string;

/**
 * The deeper receipts: relapses, the graveyard, the 3am report, devices, countries, profiles and
 * account-sharing signals. Runs in the browser on the same filtered entries as the wrapped stats.
 * Placeholder until the full implementation lands.
 */
export function computeInsights(entries: NetflixEntry[], showName: ShowNamer, hasTimeData: boolean): Insights {
  void showName;
  void hasTimeData;
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const times = entries.map((e) => e.startTime.getTime());
  const first = times.length ? new Date(Math.min(...times)) : new Date();
  const last = times.length ? new Date(Math.max(...times)) : new Date();
  return {
    relapses: [],
    graveyard: [],
    graveyardCount: 0,
    firstWatched: iso(first),
    lastWatched: iso(last),
    monthsSpanned: 1,
    hourHeatmap: null,
    devices: null,
    countries: null,
    profiles: null,
    sharing: null,
  };
}
