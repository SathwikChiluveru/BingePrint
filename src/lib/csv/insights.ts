import type {
  DayHeatmap,
  GraveyardShow,
  HourHeatmap,
  Insights,
  NetflixEntry,
  RelapseShow,
  SharingSignal,
  UsageStat,
} from "@/types";

/** title -> show name, as built by stats.ts for this history */
export type ShowNamer = (title: string) => string;

// Same marker stats.ts uses to tell an episode segment from a movie subtitle.
const EPISODE_MARKER = /\b(season|series|episode|chapter|part|volume|vol\.|book|collection)\b/i;

/** Gap (days) that separates a real comeback from resuming where you left off. */
const RELAPSE_GAP_DAYS = 30;
/** A show is only buried once it has been untouched this long, relative to the end of the history. */
const GRAVEYARD_AGE_DAYS = 60;
const GRAVEYARD_MAX_EPISODES = 3;
const GRAVEYARD_CAP = 12;
const RELAPSE_CAP = 5;
const TIMELINE_CAP = 24;
/** Minimum overlap before two devices count as playing at once (skips handoff seconds). */
const OVERLAP_MIN_MS = 5 * 60 * 1000;
const SIGNAL_CAP = 8;
const ONE_OFF_MAX_SESSIONS = 2;
const ONE_OFF_TOP_MIN_SESSIONS = 20;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEK: DayHeatmap["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local calendar date as "YYYY-MM-DD". */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local calendar day as a whole-day ordinal, so day gaps are exact across DST changes. */
function dayNumber(d: Date): number {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/** Day ordinal back to "YYYY-MM-DD". */
function dayToIso(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** "2024-03-03" -> "3 Mar 2024" */
function humanDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Local calendar day plus title: one sitting of a title (matches stats.ts titleDayKey). */
function titleDayKey(e: NetflixEntry): string {
  const d = e.startTime;
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}|${e.title.trim()}`;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

interface ShowAgg {
  /** earliest entry's time and title, for "the first episode they ever watched" */
  firstTime: number;
  firstTitle: string;
  /** all days the show was watched */
  days: Set<number>;
  /** episode title -> days it was watched */
  episodes: Map<string, Set<number>>;
  episodic: boolean;
  firstDay: number;
  lastDay: number;
}

function aggregateShows(entries: NetflixEntry[], showName: ShowNamer): Map<string, ShowAgg> {
  const shows = new Map<string, ShowAgg>();
  for (const e of entries) {
    const title = e.title.trim();
    const show = showName(e.title);
    const t = e.startTime.getTime();
    const day = dayNumber(e.startTime);
    let agg = shows.get(show);
    if (!agg) {
      agg = {
        firstTime: t,
        firstTitle: title,
        days: new Set(),
        episodes: new Map(),
        episodic: false,
        firstDay: day,
        lastDay: day,
      };
      shows.set(show, agg);
    }
    if (t < agg.firstTime) {
      agg.firstTime = t;
      agg.firstTitle = title;
    }
    if (day < agg.firstDay) agg.firstDay = day;
    if (day > agg.lastDay) agg.lastDay = day;
    agg.days.add(day);
    let epDays = agg.episodes.get(title);
    if (!epDays) {
      epDays = new Set();
      agg.episodes.set(title, epDays);
    }
    epDays.add(day);
    if (!agg.episodic && (EPISODE_MARKER.test(title) || (title.match(/:/g)?.length ?? 0) >= 2)) {
      agg.episodic = true;
    }
  }
  return shows;
}

/** Same rule as stats.ts: one distinct title, equal to the show name, with no episode marker. */
function isMovie(show: string, agg: ShowAgg): boolean {
  if (agg.episodes.size !== 1) return false;
  const only = agg.firstTitle;
  return only === show && !EPISODE_MARKER.test(only);
}

/** Keeps the first item (the original watch) and the most recent ones when over the cap. */
function capTimeline(days: number[]): string[] {
  const kept = days.length > TIMELINE_CAP ? [days[0], ...days.slice(days.length - (TIMELINE_CAP - 1))] : days;
  return kept.map(dayToIso);
}

/** All relapsing titles, unranked and uncapped. */
function findRelapses(shows: Map<string, ShowAgg>): RelapseShow[] {
  const out: RelapseShow[] = [];
  for (const [show, agg] of shows) {
    const days = [...agg.days].sort((a, b) => a - b);
    if (isMovie(show, agg)) {
      // Separate watch days, with days inside 30 days of the previous watch folded into one.
      const clusters: number[] = [];
      let prev = -Infinity;
      for (const d of days) {
        if (d - prev >= RELAPSE_GAP_DAYS) clusters.push(d);
        prev = d;
      }
      if (clusters.length >= 2) {
        out.push({ title: show, kind: "movie", restarts: clusters.length, rewatchedEpisodes: 0, timeline: capTimeline(clusters) });
      }
      continue;
    }

    // Restart: the first-ever episode again, after the show sat untouched for 30+ days.
    const firstEpDays = agg.episodes.get(agg.firstTitle) ?? new Set<number>();
    const restartDays: number[] = [];
    for (let i = 1; i < days.length; i++) {
      if (days[i] - days[i - 1] >= RELAPSE_GAP_DAYS && firstEpDays.has(days[i])) restartDays.push(days[i]);
    }

    // Rewatched: an episode seen on days 30+ apart (resuming within days does not count).
    let rewatchedEpisodes = 0;
    for (const epDays of agg.episodes.values()) {
      if (epDays.size < 2) continue;
      let min = Infinity;
      let max = -Infinity;
      for (const d of epDays) {
        if (d < min) min = d;
        if (d > max) max = d;
      }
      if (max - min >= RELAPSE_GAP_DAYS) rewatchedEpisodes++;
    }

    if (restartDays.length === 0 && rewatchedEpisodes < 3) continue;
    out.push({
      title: show,
      kind: "show",
      restarts: restartDays.length,
      rewatchedEpisodes,
      timeline: capTimeline([dayNumber(new Date(agg.firstTime)), ...restartDays]),
    });
  }
  return out;
}

function rankRelapses(all: RelapseShow[]): RelapseShow[] {
  return [...all]
    .sort((a, b) => b.restarts - a.restarts || b.rewatchedEpisodes - a.rewatchedEpisodes || a.title.localeCompare(b.title))
    .slice(0, RELAPSE_CAP);
}

/**
 * Shows quit within a few episodes. A show that keeps getting restarted (a relapse) was never
 * abandoned, however few distinct episodes it reached, so it is not buried.
 */
function computeGraveyard(
  shows: Map<string, ShowAgg>,
  historyLastDay: number,
  relapsing: Set<string>
): { list: GraveyardShow[]; count: number } {
  const buried: (GraveyardShow & { last: number })[] = [];
  for (const [show, agg] of shows) {
    if (!agg.episodic || isMovie(show, agg) || relapsing.has(show)) continue;
    const n = agg.episodes.size;
    if (n < 1 || n > GRAVEYARD_MAX_EPISODES) continue;
    if (historyLastDay - agg.lastDay < GRAVEYARD_AGE_DAYS) continue;
    buried.push({
      title: show,
      episodesWatched: n,
      firstWatched: dayToIso(agg.firstDay),
      lastWatched: dayToIso(agg.lastDay),
      last: agg.lastDay,
    });
  }
  buried.sort((a, b) => b.last - a.last || a.title.localeCompare(b.title));
  return {
    list: buried.slice(0, GRAVEYARD_CAP).map((g) => ({
      title: g.title,
      episodesWatched: g.episodesWatched,
      firstWatched: g.firstWatched,
      lastWatched: g.lastWatched,
    })),
    count: buried.length,
  };
}

function computeHeatmap(entries: NetflixEntry[]): HourHeatmap | null {
  if (entries.length === 0) return null;
  const seconds = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  let total = 0;
  let lateNight = 0;
  let threeAm = 0;
  for (const e of entries) {
    const h = e.startTime.getHours();
    const row = (e.startTime.getDay() + 6) % 7; // Mon = 0
    seconds[row][h] += e.durationSeconds;
    total += e.durationSeconds;
    if (h < 5) lateNight += e.durationSeconds;
    if (h === 3) threeAm += e.durationSeconds;
  }
  let peakRow = 0;
  let peakHour = 0;
  for (let r = 0; r < 7; r++) {
    for (let h = 0; h < 24; h++) {
      if (seconds[r][h] > seconds[peakRow][peakHour]) {
        peakRow = r;
        peakHour = h;
      }
    }
  }
  return {
    cells: seconds.map((row) => row.map((s) => Math.round(s / 60))),
    peakDay: WEEK[peakRow],
    peakHour,
    lateNightShare: total > 0 ? Math.round((lateNight / total) * 100) : 0,
    threeAmMinutes: Math.round(threeAm / 60),
  };
}

function computeUsage(entries: NetflixEntry[], key: (e: NetflixEntry) => string | undefined): UsageStat[] | null {
  const groups = new Map<string, { seconds: number; sessions: Set<string>; first: number; last: number }>();
  for (const e of entries) {
    const name = key(e)?.trim();
    if (!name) continue;
    const t = e.startTime.getTime();
    let g = groups.get(name);
    if (!g) {
      g = { seconds: 0, sessions: new Set(), first: t, last: t };
      groups.set(name, g);
    }
    g.seconds += e.durationSeconds;
    g.sessions.add(titleDayKey(e));
    if (t < g.first) g.first = t;
    if (t > g.last) g.last = t;
  }
  if (groups.size === 0) return null;
  return [...groups.entries()]
    .map(([name, g]) => ({
      name,
      seconds: g.seconds,
      sessions: g.sessions.size,
      firstSeen: isoDate(new Date(g.first)),
      lastSeen: isoDate(new Date(g.last)),
    }))
    .sort((a, b) => b.seconds - a.seconds || b.sessions - a.sessions || a.name.localeCompare(b.name));
}

/**
 * Plays on different devices whose [start, start + duration) ranges overlap by 5+ minutes.
 * One occasion per (local day, device pair), so a long overlap logged as several resume rows
 * counts once. Sort-and-sweep: only plays still running are compared.
 */
function computeOverlap(entries: NetflixEntry[]): SharingSignal | null {
  const plays = entries
    .filter((e) => e.deviceType.trim())
    .map((e) => {
      const start = e.startTime.getTime();
      return { start, end: start + e.durationSeconds * 1000, device: e.deviceType.trim() };
    })
    .sort((a, b) => a.start - b.start);

  const occasions = new Set<string>();
  let latest: { start: number; devices: [string, string] } | null = null;
  let active: typeof plays = [];
  for (const p of plays) {
    active = active.filter((a) => a.end > p.start);
    for (const a of active) {
      if (a.device === p.device) continue;
      if (Math.min(a.end, p.end) - p.start < OVERLAP_MIN_MS) continue;
      const pair = [a.device, p.device].sort() as [string, string];
      occasions.add(`${isoDate(new Date(p.start))}|${pair[0]}|${pair[1]}`);
      if (!latest || p.start >= latest.start) latest = { start: p.start, devices: [a.device, p.device] };
    }
    active.push(p);
  }
  if (!latest || occasions.size === 0) return null;

  const count = occasions.size;
  const date = isoDate(new Date(latest.start));
  const [d1, d2] = latest.devices;
  const detail =
    count === 1
      ? `Two devices were playing at the same time once, on ${humanDate(date)} (${d1} and ${d2}).`
      : `Two devices were playing at the same time on ${count} occasions, most recently ${humanDate(date)} (${d1} and ${d2}).`;
  return { kind: "overlap", detail, date, count };
}

function computeSharing(
  entries: NetflixEntry[],
  devices: UsageStat[] | null,
  countries: UsageStat[] | null
): { suspicious: boolean; signals: SharingSignal[] } {
  const signals: SharingSignal[] = [];

  const overlap = computeOverlap(entries);
  if (overlap) signals.push(overlap);

  if (countries && countries.length > 1) {
    const foreign = countries
      .slice(1)
      .filter((c) => c.sessions >= 1)
      .sort((a, b) => b.sessions - a.sessions || b.lastSeen.localeCompare(a.lastSeen));
    for (const c of foreign) {
      const plays = `${c.sessions} ${plural(c.sessions, "play was", "plays were")} logged in ${c.name}`;
      const when =
        c.firstSeen === c.lastSeen
          ? `on ${humanDate(c.lastSeen)}`
          : `between ${humanDate(c.firstSeen)} and ${humanDate(c.lastSeen)}`;
      signals.push({
        kind: "foreign-country",
        detail: `${plays}, ${when}. A holiday, or someone else's couch.`,
        date: c.lastSeen,
        count: c.sessions,
      });
    }
  }

  if (devices && devices.length > 1) {
    const top = devices.reduce((best, d) => (d.sessions > best.sessions ? d : best), devices[0]);
    if (top.sessions >= ONE_OFF_TOP_MIN_SESSIONS) {
      const oneOffs = devices
        .filter((d) => d !== top && d.sessions <= ONE_OFF_MAX_SESSIONS)
        .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
      for (const d of oneOffs) {
        const detail =
          d.sessions === 1
            ? `${d.name} showed up for a single play on ${humanDate(d.lastSeen)} and never again.`
            : `${d.name} showed up for ${d.sessions} plays, the last on ${humanDate(d.lastSeen)}, and never again.`;
        signals.push({ kind: "one-off-device", detail, date: d.lastSeen, count: d.sessions });
      }
    }
  }

  const suspicious = signals.some(
    (s) => (s.kind === "overlap" && s.count >= 3) || s.kind === "foreign-country"
  );
  return { suspicious, signals: signals.slice(0, SIGNAL_CAP) };
}

/**
 * The deeper receipts: relapses, the graveyard, the 3am report, devices, countries, profiles and
 * account-sharing signals. Runs in the browser on the same filtered entries as the wrapped stats
 * (every profile on the account). Time-of-day, device, country and profile parts need a full
 * export and are null for date-only files.
 */
export function computeInsights(entries: NetflixEntry[], showName: ShowNamer, hasTimeData: boolean): Insights {
  let firstT = Infinity;
  let lastT = -Infinity;
  for (const e of entries) {
    const t = e.startTime.getTime();
    if (Number.isNaN(t)) continue;
    if (t < firstT) firstT = t;
    if (t > lastT) lastT = t;
  }
  const valid = entries.filter((e) => !Number.isNaN(e.startTime.getTime()));
  const first = Number.isFinite(firstT) ? new Date(firstT) : new Date();
  const last = Number.isFinite(lastT) ? new Date(lastT) : first;
  const monthsSpanned = Math.max(
    1,
    (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1
  );

  const shows = aggregateShows(valid, showName);
  const allRelapses = findRelapses(shows);
  const graveyard = computeGraveyard(shows, dayNumber(last), new Set(allRelapses.map((r) => r.title)));

  const timed = hasTimeData && valid.length > 0;
  const devices = timed ? computeUsage(valid, (e) => e.deviceType) : null;
  const countries = timed ? computeUsage(valid, (e) => e.country) : null;
  const profiles = timed ? computeUsage(valid, (e) => e.profileName) : null;

  return {
    relapses: rankRelapses(allRelapses),
    graveyard: graveyard.list,
    graveyardCount: graveyard.count,
    firstWatched: isoDate(first),
    lastWatched: isoDate(last),
    monthsSpanned,
    hourHeatmap: timed ? computeHeatmap(valid) : null,
    devices,
    countries,
    profiles,
    sharing: timed ? computeSharing(valid, devices, countries) : null,
  };
}
