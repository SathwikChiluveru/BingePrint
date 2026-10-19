import { describe, expect, it } from "vitest";
import { parseNetflixCSV } from "@/lib/csv/parser";
import {
  EMPTY_HISTORY_LINE,
  computeWrappedStats,
  isLikelyMovie,
  playNoun,
  toValidDate,
  type RankedShowStat,
} from "@/lib/csv/stats";
import type { NetflixEntry } from "@/types";
import { at, loadFixture, makeEntry } from "../fixtures";

const quick = () => computeWrappedStats(parseNetflixCSV(loadFixture("quick-us-mdy.csv")));
const full = () => computeWrappedStats(parseNetflixCSV(loadFixture("full-export.csv")));

/** n date-only entries for a show, one per day starting at `start`. */
function dateOnlyEpisodes(show: string, n: number, start = at(2024, 1, 1), perDay = 1): NetflixEntry[] {
  return Array.from({ length: n }, (_, i) =>
    makeEntry({
      title: `${show}: Season 1: Episode ${i + 1}`,
      startTime: new Date(start.getFullYear(), start.getMonth(), start.getDate() + Math.floor(i / perDay), 12),
      durationSeconds: 40 * 60,
      timeEstimated: true,
    })
  );
}

describe("computeWrappedStats: date-only quick export", () => {
  const s = quick();

  it("totals estimated durations", () => {
    // 8 episodes x 40 min + 3 movies x 110 min
    expect(s.totalSeconds).toBe(8 * 2400 + 3 * 6600);
    expect(s.totalHours).toBe(11);
    expect(s.totalDays).toBe(0);
    expect(s.totalEpisodesEstimate).toBe(11);
  });

  it("reports hasTimeData false and zeroes the night-owl score", () => {
    expect(s.hasTimeData).toBe(false);
    expect(s.nightOwlScore).toBe(0);
  });

  it("ranks top shows by play count", () => {
    expect(s.topShows.map((t) => [t.title, t.watchCount])).toEqual([
      ["Stranger Things", 6],
      ["Outside", 2],
      ["Mission: Impossible", 1],
      ["Glass Onion", 1],
      ["The Irishman", 1],
    ]);
    expect(s.mostLoyalShow.title).toBe("Stranger Things");
    expect(s.uniqueShowsCount).toBe(5);
  });

  it("keeps colon titles like Mission: Impossible whole and marks them as movies", () => {
    const mi = s.topShows.find((t) => t.title === "Mission: Impossible") as RankedShowStat;
    expect(mi.kind).toBe("movie");
    expect(isLikelyMovie(mi)).toBe(true);
    expect(playNoun(mi, 1)).toBe("watch");
    expect(playNoun(mi, 2)).toBe("watches");
  });

  it("groups titles sharing a prefix (no season markers) into one show", () => {
    const outside = s.topShows.find((t) => t.title === "Outside") as RankedShowStat;
    expect(outside.kind).toBe("show");
    expect(playNoun(outside, 1)).toBe("episode");
    expect(playNoun(outside, 2)).toBe("episodes");
  });

  it("groups a season named after the show under the show name", () => {
    expect(s.topShows[0]).toMatchObject({ title: "Stranger Things", kind: "show" });
  });

  it("finds the same-day binge as the longest binge with its title count", () => {
    expect(s.longestBinge.titleCount).toBe(4);
    expect(s.longestBinge.titles).toEqual(["Stranger Things"]);
    expect(s.longestBinge.showCount).toBe(1);
    expect(s.longestBinge.totalSeconds).toBe(4 * 2400);
    // Every session has at least an hour of (estimated) viewing
    expect(s.allBingeSessions.every((b) => b.totalSeconds >= 3600)).toBe(true);
    // Sorted longest first
    const secs = s.allBingeSessions.map((b) => b.totalSeconds);
    expect([...secs].sort((a, b) => b - a)).toEqual(secs);
  });

  it("counts weeks spanned and titles per weekday", () => {
    // 2023-12-31 to 2024-03-15 is 75 days
    expect(s.weeksSpanned).toBe(11);
    expect(s.dayTitleCounts).toEqual([
      { day: "Mon", count: 1 },
      { day: "Tue", count: 1 },
      { day: "Wed", count: 0 },
      { day: "Thu", count: 1 },
      { day: "Fri", count: 4 },
      { day: "Sat", count: 2 },
      { day: "Sun", count: 2 },
    ]);
  });

  it("uses one row per title per day, so distinctTitleDays equals the entry count", () => {
    expect(s.distinctTitleDays).toBe(11);
  });

  it("leads the fun comparison with a single ~ estimate and no em dashes", () => {
    expect(s.funComparison).toBe("~11 hours. Netflix is still working out whether you're a real person.");
    expect(s.funComparison).not.toMatch(/—/);
    expect(s.funComparison.match(/~/g)).toHaveLength(1);
  });

  it("falls back to The Casual Viewer with a title count", () => {
    expect(s.personality).toBe("The Casual Viewer");
    expect(s.personalityDescription).toMatch(/^11 titles, all-time\./);
  });
});

describe("computeWrappedStats: timed full export", () => {
  const s = full();

  it("filters trailers and sub-minute plays", () => {
    // Dark 20+25+50+48, LD&R 3x15, Glass Onion 139 minutes
    expect(s.totalSeconds).toBe((20 + 25 + 50 + 48 + 45 + 139) * 60);
    expect(s.totalEpisodesEstimate).toBe(8);
    expect(s.hasTimeData).toBe(true);
  });

  it("ranks top shows by seconds watched, not play count", () => {
    expect(s.topShows.map((t) => t.title)).toEqual(["Dark", "Glass Onion", "Love, Death & Robots"]);
    // LD&R has more plays than Glass Onion but less time
    const ldr = s.topShows.find((t) => t.title === "Love, Death & Robots")!;
    const glass = s.topShows.find((t) => t.title === "Glass Onion")!;
    expect(ldr.watchCount).toBeGreaterThan(glass.watchCount);
    expect(isLikelyMovie(glass)).toBe(true);
    expect(isLikelyMovie(ldr)).toBe(false);
  });

  it("dedupes resumed rows per title per day in watchCount and distinctTitleDays", () => {
    const dark = s.topShows.find((t) => t.title === "Dark")!;
    // 4 rows, but Secrets was resumed on the same day
    expect(dark.watchCount).toBe(3);
    expect(s.distinctTitleDays).toBe(7);
  });

  it("mostLoyalShow is the show with the most plays", () => {
    expect(["Dark", "Love, Death & Robots"]).toContain(s.mostLoyalShow.title);
    expect(s.mostLoyalShow.watchCount).toBe(3);
  });

  it("chains plays within 4 hours into one binge (across midnight)", () => {
    expect(s.longestBinge.titleCount).toBe(4);
    expect(s.longestBinge.titles).toEqual(["Dark"]);
    expect(s.longestBinge.totalSeconds).toBe((20 + 25 + 50 + 48) * 60);
    expect(s.longestBinge.startTime.getHours()).toBe(21);
    expect(s.longestBinge.endTime.getTime()).toBe(at(2024, 3, 16, 1, 48).getTime());
  });

  it("scores night owl from starts between 10pm and 4am", () => {
    // 22:00 and 01:00 of 8 plays
    expect(s.nightOwlScore).toBe(25);
  });

  it("finds the peak hour", () => {
    expect(s.peakHour).toBe(18);
  });

  it("has no ~ lead on the fun comparison when times are real", () => {
    expect(s.funComparison.startsWith("~")).toBe(false);
  });

  it("calls a mostly-weekend history The Weekend Warrior", () => {
    expect(s.personality).toBe("The Weekend Warrior");
    expect(s.personalityDescription).toMatch(/^62% of your watching lands on Saturday and Sunday\./);
  });
});

describe("computeWrappedStats: empty history", () => {
  const s = computeWrappedStats([]);

  it("returns zeroed stats with no time data", () => {
    expect(s.totalSeconds).toBe(0);
    expect(s.topShows).toEqual([]);
    expect(s.allBingeSessions).toEqual([]);
    expect(s.hasTimeData).toBe(false);
    expect(s.uniqueShowsCount).toBe(0);
    expect(s.distinctTitleDays).toBe(0);
    expect(s.weeksSpanned).toBe(1);
    expect(s.longestBinge.titleCount).toBe(0);
  });

  it("uses the shared empty-history line, never ~0 hours", () => {
    expect(s.funComparison).toBe(EMPTY_HISTORY_LINE);
    expect(s.personality).toBe("The Casual Viewer");
    expect(s.personalityDescription).toBe(EMPTY_HISTORY_LINE);
  });

  it("treats a history of only trailers as empty", () => {
    const t = computeWrappedStats([
      makeEntry({ title: "Trailer", startTime: at(2024, 1, 1, 20), supplementalVideoType: "TRAILER" }),
    ]);
    expect(t.totalEpisodesEstimate).toBe(0);
    expect(t.hasTimeData).toBe(false);
    expect(t.funComparison).toBe(EMPTY_HISTORY_LINE);
  });
});

describe("computeWrappedStats: show naming", () => {
  const titles = (list: string[]) =>
    computeWrappedStats(list.map((title, i) => makeEntry({ title, startTime: at(2024, 1, 1 + i * 2, 20) })))
      .topShows.map((t) => t.title)
      .sort();

  it("strips episode suffixes on season/episode markers", () => {
    expect(titles(["The Crown: Season 1: Wolferton Splash"])).toEqual(["The Crown"]);
    expect(titles(["Arcane: League of Legends: Act I: Welcome to the Playground"])).toEqual(["Arcane"]);
  });

  it("uses the first segment for any 3-part title", () => {
    expect(titles(["Show: Something: Else"])).toEqual(["Show"]);
  });

  it("keeps a lone 2-part colon title whole", () => {
    expect(titles(["Mission: Impossible"])).toEqual(["Mission: Impossible"]);
  });

  it("groups 2-part titles that share a prefix", () => {
    expect(titles(["Outside: The Deal", "Outside: Time's Up"])).toEqual(["Outside"]);
  });

  it("puts nameless episodes under 'Untitled series'", () => {
    expect(titles([" : Episode 23", " : Episode 24"])).toEqual(["Untitled series"]);
  });
});

describe("computeWrappedStats: personality rules", () => {
  it("Night Owl when over 60% of starts are late", () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ title: `Night ${i}`, startTime: at(2024, 1, 1 + i * 2, i < 7 ? 23 : 15) })
    );
    const s = computeWrappedStats(entries);
    expect(s.personality).toBe("The Night Owl");
    expect(s.personalityDescription).toMatch(/^70% of your watching starts after 10pm\./);
  });

  it("Binge Lord when binges average over 5 hours, quoting titles", () => {
    // Monday 8 x 45 minutes back to back = 6h session
    const entries = Array.from({ length: 8 }, (_, i) =>
      makeEntry({ title: `Show: Season 1: Ep ${i}`, startTime: at(2024, 1, 1, 12, i * 45) })
    );
    const s = computeWrappedStats(entries);
    expect(s.personality).toBe("The Binge Lord");
    expect(s.personalityDescription).toMatch(/^Your binges average 8 titles\./);
  });

  it("timed Loyalist: many short plays of one show", () => {
    // 25 ten-minute plays on separate weekdays, afternoons
    const entries = Array.from({ length: 25 }, (_, i) =>
      makeEntry({
        title: `Shorts: Season 1: Ep ${i}`,
        startTime: at(2024, 1, 1 + i * 7, 15),
        durationSeconds: 600,
      })
    );
    const s = computeWrappedStats(entries);
    expect(s.personality).toBe("The Loyalist");
    expect(s.personalityDescription).toMatch(/^25 plays of Shorts\./);
  });

  it("date-only Loyalist: one show with >=15% share and >=50 plays, even with long binges", () => {
    // 60 episodes, 10 per day: each day is a 6.7h estimated "binge"
    const entries = dateOnlyEpisodes("Friends", 60, at(2024, 1, 1), 10);
    const s = computeWrappedStats(entries);
    expect(s.hasTimeData).toBe(false);
    expect(s.personality).toBe("The Loyalist");
    expect(s.personalityDescription).toMatch(/^60 plays of Friends\./);
  });

  it("date-only with under 50 plays of the top show is not a Loyalist", () => {
    const entries = dateOnlyEpisodes("Friends", 49, at(2024, 1, 1), 10);
    expect(computeWrappedStats(entries).personality).not.toBe("The Loyalist");
  });

  it("Genre Surfer with over 40 distinct shows", () => {
    // 41 movies on weekday afternoons, a few days apart
    const entries = Array.from({ length: 41 }, (_, i) =>
      makeEntry({ title: `Film ${i}`, startTime: at(2024, 1, 1 + i * 7, 15), durationSeconds: 1800 })
    );
    const s = computeWrappedStats(entries);
    expect(s.personality).toBe("The Genre Surfer");
    expect(s.personalityDescription).toMatch(/^41 different shows and movies\./);
  });

  it("Casual Viewer copy uses the singular for one title", () => {
    const s = computeWrappedStats([makeEntry({ title: "Roma", startTime: at(2024, 1, 1, 15) })]);
    expect(s.personality).toBe("The Casual Viewer");
    expect(s.personalityDescription).toMatch(/^1 title, all-time\./);
  });
});

describe("computeWrappedStats: funComparison wording", () => {
  const withHours = (hours: number, estimated: boolean) =>
    computeWrappedStats(
      Array.from({ length: hours }, (_, i) =>
        makeEntry({
          title: `Film ${i}`,
          startTime: at(2020, 1, 1 + i, 15),
          durationSeconds: 3600,
          timeEstimated: estimated || undefined,
        })
      )
    ).funComparison;

  it.each([
    [1, "~1 hour. Netflix is still working out"],
    [60, "~60 hours. That's the extended Lord of the Rings trilogy 5 times over."],
    [120, "~120 hours. That's 10 all-nighters."],
    [210, "~210 hours. That's 210 episodes of a 1-hour show."],
    [300, "~300 hours. That's 13 days nonstop, or every Best Picture winner back to back with hours to spare."],
    [460, "~460 hours. That's 19 days nonstop, or every Best Picture winner back to back, twice over."],
  ])("estimated %i hours", (hours, expected) => {
    const line = withHours(hours, true);
    expect(line.startsWith(expected)).toBe(true);
    expect(line).not.toMatch(/[—–]/);
  });

  it("timed totals get no ~ lead", () => {
    expect(withHours(60, false)).toBe("That's the extended Lord of the Rings trilogy 5 times over.");
  });
});

describe("toValidDate", () => {
  it("accepts Dates, ISO strings and epoch numbers", () => {
    const d = new Date(2024, 0, 1);
    expect(toValidDate(d)).toBe(d);
    expect(toValidDate("2024-01-01T00:00:00.000Z")?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(toValidDate(0)?.getTime()).toBe(0);
  });

  it("returns null for null, undefined and garbage", () => {
    expect(toValidDate(null)).toBeNull();
    expect(toValidDate(undefined)).toBeNull();
    expect(toValidDate("nope")).toBeNull();
  });
});
