export interface NetflixEntry {
  profileName: string;
  title: string;
  startTime: Date;
  durationSeconds: number;
  deviceType: string;
  supplementalVideoType: string;
  country?: string; // full export only, e.g. "US (United States)"
  timeEstimated?: boolean; // true when the CSV had dates only; startTime is noon and duration is estimated
}

/*
  Insights: the deeper receipts (relapses, graveyard, 3am report, devices, countries). They are
  computed in the browser and never leave it: toGroupSummary drops them and the server's zod
  summary schema strips unknown keys. Dates are ISO "YYYY-MM-DD" strings in the viewer's local time.
*/

/** A title the viewer keeps coming back to. */
export interface RelapseShow {
  title: string; // show name, or the movie title
  kind: "show" | "movie";
  /** Shows: times the show was started over (its first-ever episode watched again after a 30+ day gap).
   *  Movies: total separate days it was watched. */
  restarts: number;
  /** Distinct episodes watched on 2+ separate days (shows); 0 for movies */
  rewatchedEpisodes: number;
  /** One ISO date per relapse (each restart or rewatch day), chronological, at most 24 */
  timeline: string[];
}

/** A show quit within a few episodes and never resumed. */
export interface GraveyardShow {
  title: string;
  episodesWatched: number; // distinct episodes
  firstWatched: string; // ISO date
  lastWatched: string; // ISO date
}

export interface HourHeatmap {
  /** 7 rows Mon..Sun, 24 columns hour 0..23 (local time), minutes watched */
  cells: number[][];
  peakDay: DayHeatmap["day"];
  peakHour: number; // 0-23
  /** Percent (0-100) of watch time that started between midnight and 5am */
  lateNightShare: number;
  /** Minutes started in the 3am hour, all-time */
  threeAmMinutes: number;
}

export interface UsageStat {
  name: string; // device type, country, or profile name
  seconds: number;
  sessions: number; // distinct (title, day) plays
  firstSeen: string; // ISO date
  lastSeen: string; // ISO date
}

export interface SharingSignal {
  kind: "overlap" | "foreign-country" | "one-off-device";
  /** One plain sentence, viewer-facing, e.g. "Two devices played at once on 3 Mar 2024: Chrome PC and an LG TV." */
  detail: string;
  date: string; // ISO date of the most recent occurrence
  count: number; // occurrences
}

export interface Insights {
  relapses: RelapseShow[]; // top 5, most relapses first
  graveyard: GraveyardShow[]; // up to 12, most recent burial first
  graveyardCount: number; // all buried shows, before the cap
  firstWatched: string; // ISO date of the earliest entry
  lastWatched: string; // ISO date of the latest entry
  monthsSpanned: number; // calendar months from first to last entry, min 1
  /** Full export only (null for date-only files) */
  hourHeatmap: HourHeatmap | null;
  devices: UsageStat[] | null;
  countries: UsageStat[] | null;
  profiles: UsageStat[] | null;
  sharing: { suspicious: boolean; signals: SharingSignal[] } | null;
}

export interface ShowStat {
  title: string;
  watchCount: number;
  totalSeconds: number;
}

export interface BingeSession {
  startTime: Date;
  endTime: Date;
  totalSeconds: number;
  showCount: number;
  titles: string[];
  titleCount?: number; // number of titles watched in the session (exact, even when durations are estimated)
}

export interface DayHeatmap {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  hours: number;
}

export type Personality =
  | "The Binge Lord"
  | "The Night Owl"
  | "The Weekend Warrior"
  | "The Loyalist"
  // Was "The Genre Surfer": the export has no genre data, only how many different titles got a try.
  // Older stored stats are upgraded on load (upgradeStoredStats in src/lib/csv/stats.ts).
  | "The Channel Surfer"
  | "The Casual Viewer";

export interface WrappedStats {
  totalSeconds: number;
  totalHours: number;
  totalDays: number;
  topShows: ShowStat[];
  mostLoyalShow: ShowStat;
  longestBinge: BingeSession;
  allBingeSessions: BingeSession[];
  nightOwlScore: number; // 0-100
  dayHeatmap: DayHeatmap[];
  personality: Personality;
  personalityDescription: string;
  funComparison: string;
  peakHour: number; // 0-23
  uniqueShowsCount: number;
  totalEpisodesEstimate: number;
  hasTimeData: boolean; // false when the CSV had dates only (no time of day / duration); durations are estimated
  weeksSpanned?: number; // weeks between first and last entry (min 1), for per-weekday averages
  dayTitleCounts?: DayTitleCount[]; // titles started per weekday (exact, even for date-only exports)
  distinctTitleDays?: number; // unique (title, calendar day) pairs: dedupes resumed-viewing rows in timed exports; equals the entry count for date-only
  insights?: Insights; // device-local only; absent on stats stored before insights existed and on group members
}

export interface DayTitleCount {
  day: DayHeatmap["day"];
  count: number;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string | null;
  nickname: string;
  wrapped_data: WrappedStats;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
  members?: GroupMember[];
}
