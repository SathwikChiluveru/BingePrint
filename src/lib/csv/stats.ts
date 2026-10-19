import type {
  NetflixEntry,
  WrappedStats,
  ShowStat,
  BingeSession,
  DayHeatmap,
  DayTitleCount,
  Personality,
} from "@/types";

const DAYS: DayHeatmap["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Segment after the show name that marks an episode, e.g. "Show: Season 2: Pilot".
const EPISODE_MARKER = /\b(season|series|episode|chapter|part|volume|vol\.|book|collection)\b/i;

type ShowNamer = (title: string) => string;

const UNTITLED_SHOW = "Untitled series";

/**
 * A ranked show plus whether it is really a movie. `kind` is optional so stats stored before it
 * existed still type-check; those read as shows (the old wording).
 */
export type RankedShowStat = ShowStat & { kind?: "show" | "movie" };

/** True when the entry is a movie (one title, no episode structure) rather than a series. */
export function isLikelyMovie(show: ShowStat | null | undefined): boolean {
  return (show as RankedShowStat | null | undefined)?.kind === "movie";
}

/** Count noun for a top-show line: movies get rewatched, series have episodes. */
export function playNoun(show: ShowStat | null | undefined, count: number): string {
  if (isLikelyMovie(show)) return count === 1 ? "watch" : "watches";
  return count === 1 ? "episode" : "episodes";
}

/** Shared empty-history copy, so no slide or card ever says "~0 hours". */
export const EMPTY_HISTORY_LINE = "Nothing on record yet. Either you're brand new or that file was empty.";

/**
 * Builds a title -> show-name function for one history.
 * Netflix writes episodes as "Show: Season 1: Episode", but movies can carry a colon too
 * ("Mission: Impossible"), so the suffix is only stripped when it looks like an episode:
 *  - a later segment names a season/episode/part/volume/limited series,
 *  - there are 2+ colons (Netflix's "Show: Season: Episode" shape), or
 *  - 2+ distinct titles share the prefix ("Outside: The Deal", "Outside: Time's Up").
 */
function makeShowNamer(entries: NetflixEntry[]): ShowNamer {
  const prefixTitles = new Map<string, Set<string>>();
  for (const e of entries) {
    const idx = e.title.indexOf(":");
    if (idx <= 0) continue;
    const prefix = e.title.slice(0, idx).trim();
    if (!prefixTitles.has(prefix)) prefixTitles.set(prefix, new Set());
    prefixTitles.get(prefix)!.add(e.title);
  }

  const cache = new Map<string, string>();
  return (title: string) => {
    const cached = cache.get(title);
    if (cached !== undefined) return cached;

    const segments = title.split(":");
    let show = title.trim();
    if (segments.length > 1) {
      const markerIdx = segments.findIndex((seg, i) => i > 0 && EPISODE_MARKER.test(seg));
      const first = segments[0].trim();
      if (
        segments.length >= 3 &&
        first &&
        segments[1].trim().toLowerCase().startsWith(first.toLowerCase())
      ) {
        // Season named after the show: "Stranger Things: Stranger Things 4: Chapter One"
        show = first;
      } else if (markerIdx > 0) {
        show = segments.slice(0, markerIdx).join(":").trim();
      } else if (segments.length >= 3) {
        show = segments[0].trim();
      } else {
        const prefix = segments[0].trim();
        if ((prefixTitles.get(prefix)?.size ?? 0) >= 2) show = prefix;
      }
    }
    // Some exports drop the show name (" : Episode 23"); keep those together, not blank.
    if (!show) show = segments.length > 1 ? UNTITLED_SHOW : title.trim();
    cache.set(title, show);
    return show;
  };
}

function groupByShow(entries: NetflixEntry[], showName: ShowNamer): Map<string, NetflixEntry[]> {
  const map = new Map<string, NetflixEntry[]>();
  for (const entry of entries) {
    const show = showName(entry.title);
    if (!map.has(show)) map.set(show, []);
    map.get(show)!.push(entry);
  }
  return map;
}

function computeBingeSessions(
  entries: NetflixEntry[],
  showName: ShowNamer,
  gapThresholdMs = 4 * 60 * 60 * 1000
): BingeSession[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  const sessions: BingeSession[] = [];
  let sessionStart = sorted[0].startTime;
  let sessionEnd = new Date(
    sorted[0].startTime.getTime() + sorted[0].durationSeconds * 1000
  );
  let sessionSeconds = sorted[0].durationSeconds;
  let sessionTitles = [showName(sorted[0].title)];
  let sessionTitleCount = 1;

  for (let i = 1; i < sorted.length; i++) {
    const entry = sorted[i];
    const entryStart = entry.startTime.getTime();
    const prevEnd = sessionEnd.getTime();

    if (entryStart - prevEnd <= gapThresholdMs) {
      sessionEnd = new Date(
        Math.max(prevEnd, entryStart + entry.durationSeconds * 1000)
      );
      sessionSeconds += entry.durationSeconds;
      sessionTitleCount++;
      const show = showName(entry.title);
      if (!sessionTitles.includes(show)) sessionTitles.push(show);
    } else {
      if (sessionSeconds >= 3600) {
        sessions.push({
          startTime: sessionStart,
          endTime: sessionEnd,
          totalSeconds: sessionSeconds,
          showCount: sessionTitles.length,
          titles: sessionTitles,
          titleCount: sessionTitleCount,
        });
      }
      sessionStart = entry.startTime;
      sessionEnd = new Date(entryStart + entry.durationSeconds * 1000);
      sessionSeconds = entry.durationSeconds;
      sessionTitles = [showName(entry.title)];
      sessionTitleCount = 1;
    }
  }

  if (sessionSeconds >= 3600) {
    sessions.push({
      startTime: sessionStart,
      endTime: sessionEnd,
      totalSeconds: sessionSeconds,
      showCount: sessionTitles.length,
      titles: sessionTitles,
      titleCount: sessionTitleCount,
    });
  }

  return sessions.sort((a, b) => b.totalSeconds - a.totalSeconds);
}

function computePersonality(
  nightOwlScore: number,
  topShows: ShowStat[],
  bingeSessions: BingeSession[],
  dayHeatmap: DayHeatmap[],
  totalHours: number,
  uniqueShows: number,
  totalTitles: number,
  hasTimeData: boolean
): { personality: Personality; description: string } {
  const weekendHours =
    (dayHeatmap.find((d) => d.day === "Sat")?.hours ?? 0) +
    (dayHeatmap.find((d) => d.day === "Sun")?.hours ?? 0);
  const weekendRatio = weekendHours / (totalHours || 1);

  const avgBingeHours =
    bingeSessions.reduce((s, b) => s + b.totalSeconds, 0) /
    (bingeSessions.length || 1) /
    3600;
  // Title counts are exact even for date-only exports, so the copy quotes those, not hours.
  const avgBingeTitles = Math.round(
    bingeSessions.reduce((s, b) => s + (b.titleCount ?? b.showCount), 0) / (bingeSessions.length || 1)
  );

  const loyalistScore =
    topShows.length > 0 ? topShows[0].watchCount / (topShows[0].totalSeconds / 3600) : 0;
  // Date-only exports estimate every duration from the same per-title guess, so plays per hour
  // is near constant there and the timed test can never pass. They use the exact play share:
  // one show holding at least 15% of everything played, across at least 50 plays.
  const topPlays = topShows[0]?.watchCount ?? 0;
  const topShare = totalTitles > 0 ? topPlays / totalTitles : 0;
  const dateOnlyLoyalist = topShare >= 0.15 && topPlays >= 50;
  const loyalist = () => ({
    personality: "The Loyalist" as const,
    description: `${topPlays.toLocaleString()} plays of ${topShows[0].title}. You found one show and made it your whole personality.`,
  });

  if (nightOwlScore > 60) {
    return {
      personality: "The Night Owl",
      description: `${nightOwlScore}% of your watching starts after 10pm. Sleep is for people without Netflix.`,
    };
  }
  if (weekendRatio > 0.55) {
    return {
      personality: "The Weekend Warrior",
      description: `${Math.round(weekendRatio * 100)}% of your watching lands on Saturday and Sunday. Monday to Friday is just the trailer.`,
    };
  }
  // Date-only binge hours are estimates (a binge is a calendar day), while the play share is exact,
  // so for those exports a clear one-show habit outranks the estimated binge average.
  if (!hasTimeData && dateOnlyLoyalist) return loyalist();
  if (avgBingeHours > 5) {
    return {
      personality: "The Binge Lord",
      description: `Your binges average ${avgBingeTitles.toLocaleString()} titles. "Just one more" has never once been true.`,
    };
  }
  if (hasTimeData && loyalistScore > 3 && topPlays > 20) return loyalist();
  // Counts every distinct show; topShows is capped at 5, so it could never pass this check.
  if (uniqueShows > 40) {
    return {
      personality: "The Genre Surfer",
      description: `${uniqueShows.toLocaleString()} different shows and movies. You contain multitudes, most of them unfinished.`,
    };
  }
  if (totalTitles <= 0) {
    return { personality: "The Casual Viewer", description: EMPTY_HISTORY_LINE };
  }
  return {
    personality: "The Casual Viewer",
    description: `${totalTitles.toLocaleString()} ${totalTitles === 1 ? "title" : "titles"}, all-time. Netflix keeps asking if you're still watching.`,
  };
}

// Every Academy Award Best Picture winner back to back, in hours.
// Sourced estimate, not an exact sum: Gold Derby (2022, "Longest Best Picture Oscar winners",
// goldderby.com/article/2022/longest-best-picture-oscar-winners) puts the all-time average
// winner at 138 minutes across 93 winners; the Wall Street Journal reported a 140-minute
// average for winners since 1928. ~98 winners through the 2026 ceremony x ~138 min is about
// 225 hours. Checked 2026-10-18. (The previous 420h figure was roughly 2x too high.)
const BEST_PICTURE_MARATHON_HOURS = 225;
// Lord of the Rings trilogy, extended editions.
const LOTR_EXTENDED_HOURS = 11.4;

/**
 * One comparison line for the total-time slide. Estimated totals (date-only exports) open
 * with "~N hours" so the single estimate marker leads the sentence instead of trailing it.
 */
function funComparison(totalHours: number, estimated: boolean, totalTitles: number): string {
  // Nothing watched: the empty-state line, never "~0 hours".
  if (totalTitles <= 0) return EMPTY_HISTORY_LINE;
  const hours = Math.max(0, Math.round(totalHours));
  const times = (n: number) => (n === 2 ? "twice" : `${n.toLocaleString()} times`);
  const days = Math.round(hours / 24).toLocaleString();
  const lead = estimated ? `~${hours.toLocaleString()} ${hours === 1 ? "hour" : "hours"}. ` : "";

  if (hours >= BEST_PICTURE_MARATHON_HOURS * 2) {
    const n = Math.floor(hours / BEST_PICTURE_MARATHON_HOURS);
    return `${lead}That's ${days} days nonstop, or every Best Picture winner back to back, ${times(n)} over.`;
  }
  if (hours >= BEST_PICTURE_MARATHON_HOURS) {
    return `${lead}That's ${days} days nonstop, or every Best Picture winner back to back with hours to spare.`;
  }
  if (hours >= 200) {
    return `${lead}That's ${hours.toLocaleString()} episodes of a 1-hour show. Your TV deserves a salary.`;
  }
  if (hours >= 100) {
    return `${lead}That's ${Math.round(hours / 12).toLocaleString()} all-nighters. Your couch has a dent shaped like you.`;
  }
  if (hours >= 50) {
    return `${lead}That's the extended Lord of the Rings trilogy ${times(Math.round(hours / LOTR_EXTENDED_HOURS))} over.`;
  }
  return `${lead}Netflix is still working out whether you're a real person.`;
}

/** Persisted stats come back from JSON with dates as strings; returns null when unusable. */
export function toValidDate(value: unknown): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function computeWrappedStats(entries: NetflixEntry[]): WrappedStats {
  // Filter out trailers/clips
  const watchEntries = entries.filter(
    (e) => !e.supplementalVideoType && e.durationSeconds >= 60
  );

  const totalSeconds = watchEntries.reduce((s, e) => s + e.durationSeconds, 0);
  const totalHours = Math.round(totalSeconds / 3600);
  const totalDays = Math.round(totalSeconds / 86400);

  // Shows
  const showName = makeShowNamer(watchEntries);
  const showMap = groupByShow(watchEntries, showName);
  // Date-only exports have no time of day, so hour-based stats are meaningless.
  // An empty history has no times either; without this it would report a "midnight" peak.
  const hasTimeData = watchEntries.length > 0 && !watchEntries.some((e) => e.timeEstimated);

  // With real durations, rank by time watched. Date-only durations are estimates, so rank by
  // the exact play count there and only use estimated seconds to break ties.
  // A "show" made of one distinct title that the namer left whole has no episode structure:
  // it is a movie (watched once or rewatched), so the copy says "watches", not "episodes".
  const showStats: RankedShowStat[] = Array.from(showMap.entries())
    .map(([title, eps]): RankedShowStat => {
      const distinct = new Set(eps.map((e) => e.title.trim()));
      const only = distinct.size === 1 ? [...distinct][0] : null;
      const kind = only !== null && only === title && !EPISODE_MARKER.test(only) ? "movie" : "show";
      return {
        title,
        watchCount: eps.length,
        totalSeconds: eps.reduce((s, e) => s + e.durationSeconds, 0),
        kind,
      };
    })
    .sort((a, b) =>
      hasTimeData
        ? b.totalSeconds - a.totalSeconds
        : b.watchCount - a.watchCount || b.totalSeconds - a.totalSeconds
    );

  const topShows = showStats.slice(0, 5);
  const mostLoyalShow = [...showStats].sort((a, b) => b.watchCount - a.watchCount)[0] ?? topShows[0];

  // Binge sessions
  const allBingeSessions = computeBingeSessions(watchEntries, showName);
  const longestBinge = allBingeSessions[0] ?? {
    startTime: new Date(),
    endTime: new Date(),
    totalSeconds: 0,
    showCount: 0,
    titles: [],
    titleCount: 0,
  };

  const times = watchEntries.map((e) => e.startTime.getTime());
  const spanMs = times.length > 0 ? Math.max(...times) - Math.min(...times) : 0;
  const weeksSpanned = Math.max(1, Math.round(spanMs / (7 * 24 * 60 * 60 * 1000)));

  // Night owl score
  const nightViews = watchEntries.filter((e) => {
    const h = e.startTime.getHours();
    return h >= 22 || h < 4;
  });
  const nightOwlScore = hasTimeData
    ? Math.round((nightViews.length / (watchEntries.length || 1)) * 100)
    : 0;

  // Peak hour
  const hourCounts = new Array(24).fill(0);
  watchEntries.forEach((e) => hourCounts[e.startTime.getHours()]++);
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

  // Day heatmap
  const dayTotals: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  const dayCounts: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
  watchEntries.forEach((e) => {
    const d = dayNames[e.startTime.getDay()];
    dayTotals[d] += e.durationSeconds / 3600;
    dayCounts[d]++;
  });
  // Exact titles per weekday: the honest lead when durations are estimated.
  const dayTitleCounts: DayTitleCount[] = DAYS.map((day) => ({ day, count: dayCounts[day] }));
  const dayHeatmap: DayHeatmap[] = DAYS.map((day) => ({
    day,
    hours: Math.round(dayTotals[day] * 10) / 10,
  }));

  const { personality, description: personalityDescription } = computePersonality(
    nightOwlScore,
    topShows,
    allBingeSessions,
    dayHeatmap,
    totalHours,
    showStats.length,
    watchEntries.length,
    hasTimeData
  );

  // Unique (title, calendar day) pairs. Timed exports log a new row each time a title is resumed,
  // so this dedupes those; date-only exports already have one row per title per day, so it
  // equals the entry count there.
  const titleDays = new Set<string>();
  for (const e of watchEntries) {
    const d = e.startTime;
    titleDays.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}|${e.title.trim()}`);
  }
  const distinctTitleDays = titleDays.size;

  return {
    totalSeconds,
    totalHours,
    totalDays,
    topShows,
    mostLoyalShow,
    longestBinge,
    allBingeSessions,
    nightOwlScore,
    dayHeatmap,
    personality,
    personalityDescription,
    funComparison: funComparison(totalHours, !hasTimeData, watchEntries.length),
    peakHour,
    uniqueShowsCount: showStats.length,
    totalEpisodesEstimate: watchEntries.length,
    hasTimeData,
    weeksSpanned,
    dayTitleCounts,
    distinctTitleDays,
  };
}
