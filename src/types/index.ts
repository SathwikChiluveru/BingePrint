export interface NetflixEntry {
  profileName: string;
  title: string;
  startTime: Date;
  durationSeconds: number;
  deviceType: string;
  supplementalVideoType: string;
  timeEstimated?: boolean; // true when the CSV had dates only; startTime is noon and duration is estimated
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
