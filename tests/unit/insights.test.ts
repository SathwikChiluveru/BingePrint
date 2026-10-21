import { describe, expect, it } from "vitest";
import { computeInsights } from "@/lib/csv/insights";
import { parseNetflixCSV } from "@/lib/csv/parser";
import { computeWrappedStats } from "@/lib/csv/stats";
import type { NetflixEntry } from "@/types";
import { at, loadFixture, makeEntry } from "../fixtures";

/** Simple namer for hand-built entries: "Show: Season 1: Ep" -> "Show"; no colon -> whole title. */
const namer = (title: string) => (title.includes(":") ? title.split(":")[0].trim() : title.trim());
const timed = (entries: NetflixEntry[]) => computeInsights(entries, namer, true);
const dateOnly = (entries: NetflixEntry[]) =>
  computeInsights(
    entries.map((e) => ({ ...e, timeEstimated: true })),
    namer,
    false
  );

const ep = (show: string, n: number, startTime: Date, extra: Partial<NetflixEntry> = {}) =>
  makeEntry({ title: `${show}: Season 1: Episode ${n}`, startTime, ...extra });

describe("computeInsights: span", () => {
  it("does not throw on an empty history", () => {
    const i = timed([]);
    expect(i.relapses).toEqual([]);
    expect(i.graveyard).toEqual([]);
    expect(i.graveyardCount).toBe(0);
    expect(i.monthsSpanned).toBe(1);
    expect(i.hourHeatmap).toBeNull();
    expect(i.devices).toBeNull();
    expect(i.sharing).toBeNull();
    expect(i.firstWatched).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reports first/last dates and inclusive calendar months", () => {
    const i = timed([ep("A", 1, at(2023, 11, 30)), ep("A", 2, at(2024, 2, 1))]);
    expect(i.firstWatched).toBe("2023-11-30");
    expect(i.lastWatched).toBe("2024-02-01");
    expect(i.monthsSpanned).toBe(4);
    expect(timed([ep("A", 1, at(2024, 5, 1)), ep("A", 2, at(2024, 5, 31))]).monthsSpanned).toBe(1);
  });
});

describe("computeInsights: relapses", () => {
  it("counts restarts of the first-ever episode after 30+ day gaps, with the first watch on the timeline", () => {
    const i = timed([
      ep("Friends", 1, at(2022, 1, 1)),
      ep("Friends", 2, at(2022, 1, 1, 13)),
      ep("Friends", 1, at(2022, 3, 1)),
      ep("Friends", 1, at(2023, 1, 1)),
    ]);
    expect(i.relapses).toHaveLength(1);
    expect(i.relapses[0]).toMatchObject({ title: "Friends", kind: "show", restarts: 2, rewatchedEpisodes: 1 });
    expect(i.relapses[0].timeline).toEqual(["2022-01-01", "2022-03-01", "2023-01-01"]);
  });

  it("does not count resuming within a day or a week as a relapse", () => {
    const i = timed([
      ep("Dark", 1, at(2024, 1, 1, 21)),
      ep("Dark", 1, at(2024, 1, 1, 22)),
      ep("Dark", 1, at(2024, 1, 2)),
      ep("Dark", 2, at(2024, 1, 8)),
      ep("Dark", 1, at(2024, 1, 9)),
    ]);
    expect(i.relapses).toEqual([]);
  });

  it("needs the show itself to have been untouched 30+ days, not just the episode", () => {
    // Episode 1 again 40 days later, but the show was watched in between: a rewatch, not a restart
    const i = timed([
      ep("Dark", 1, at(2024, 1, 1)),
      ep("Dark", 2, at(2024, 1, 20)),
      ep("Dark", 1, at(2024, 2, 10)),
    ]);
    expect(i.relapses).toEqual([]);
  });

  it("lists a show with no restart but 3+ episodes rewatched months apart", () => {
    const i = timed([
      ep("Office", 5, at(2023, 1, 1)),
      ep("Office", 6, at(2023, 1, 2)),
      ep("Office", 7, at(2023, 1, 3)),
      // Back months later, but starting from episode 6, so the first-ever episode is not a restart
      ep("Office", 6, at(2023, 6, 1)),
      ep("Office", 7, at(2023, 6, 2)),
      ep("Office", 5, at(2023, 6, 3)),
    ]);
    expect(i.relapses[0]).toMatchObject({ title: "Office", restarts: 0, rewatchedEpisodes: 3 });
  });

  it("counts a movie's separate watch days, folding days within 30 days together", () => {
    const movie = (d: Date) => makeEntry({ title: "Paddington 2", startTime: d, durationSeconds: 100 * 60 });
    const i = timed([movie(at(2022, 1, 1)), movie(at(2022, 1, 2)), movie(at(2022, 12, 25)), movie(at(2023, 12, 25))]);
    expect(i.relapses[0]).toMatchObject({ title: "Paddington 2", kind: "movie", restarts: 3, rewatchedEpisodes: 0 });
    expect(i.relapses[0].timeline).toEqual(["2022-01-01", "2022-12-25", "2023-12-25"]);
    // Watched twice in one week is just finishing it
    expect(timed([movie(at(2022, 1, 1)), movie(at(2022, 1, 5))]).relapses).toEqual([]);
  });

  it("ranks by restarts then rewatched episodes and caps at 5", () => {
    const entries: NetflixEntry[] = [];
    for (let s = 0; s < 7; s++) {
      const show = `Show${s}`;
      entries.push(ep(show, 1, at(2020, 1, 1)));
      for (let r = 0; r <= s; r++) entries.push(ep(show, 1, at(2020 + r + 1, 1, 1)));
    }
    const i = timed(entries);
    expect(i.relapses.map((r) => r.title)).toEqual(["Show6", "Show5", "Show4", "Show3", "Show2"]);
    expect(i.relapses[0].restarts).toBe(7);
  });

  it("caps the timeline at 24 dates, keeping the first watch", () => {
    const entries = [ep("Loop", 1, at(2000, 1, 1))];
    for (let m = 1; m <= 40; m++) entries.push(ep("Loop", 1, at(2000, 1 + m * 2, 1)));
    const r = timed(entries).relapses[0];
    expect(r.restarts).toBe(40);
    expect(r.timeline).toHaveLength(24);
    expect(r.timeline[0]).toBe("2000-01-01");
  });
});

describe("computeInsights: graveyard", () => {
  const recent = ep("Current", 1, at(2024, 6, 1));

  it("buries episodic shows quit within 3 episodes, 60+ days before the history ends", () => {
    const i = timed([
      ep("Lupin", 1, at(2023, 1, 1)),
      ep("Ozark", 1, at(2023, 3, 1)),
      ep("Ozark", 2, at(2023, 3, 2)),
      ep("Long", 1, at(2023, 1, 1)),
      ep("Long", 2, at(2023, 1, 2)),
      ep("Long", 3, at(2023, 1, 3)),
      ep("Long", 4, at(2023, 1, 4)),
      ep("Fresh", 1, at(2024, 5, 1)), // only 31 days old: not buried yet
      makeEntry({ title: "Mission: Impossible", startTime: at(2022, 1, 1) }), // a movie with a colon
      recent,
    ]);
    expect(i.graveyard.map((g) => g.title)).toEqual(["Ozark", "Lupin"]);
    expect(i.graveyard[0]).toEqual({
      title: "Ozark",
      episodesWatched: 2,
      firstWatched: "2023-03-01",
      lastWatched: "2023-03-02",
    });
    expect(i.graveyardCount).toBe(2);
  });

  it("caps at 12 but counts every burial", () => {
    const entries = Array.from({ length: 15 }, (_, k) => ep(`Dead${k}`, 1, at(2022, 1, k + 1)));
    const i = timed([...entries, recent]);
    expect(i.graveyard).toHaveLength(12);
    expect(i.graveyardCount).toBe(15);
    expect(i.graveyard[0].title).toBe("Dead14");
  });
});

describe("computeInsights: date-only exports", () => {
  it("returns null for time-based parts but still computes relapses and the graveyard", () => {
    const i = dateOnly([
      ep("Friends", 1, at(2022, 1, 1)),
      ep("Friends", 1, at(2022, 6, 1)),
      ep("Lupin", 1, at(2022, 2, 1)),
      ep("Other", 1, at(2023, 1, 1)),
    ]);
    expect(i.hourHeatmap).toBeNull();
    expect(i.devices).toBeNull();
    expect(i.countries).toBeNull();
    expect(i.profiles).toBeNull();
    expect(i.sharing).toBeNull();
    expect(i.relapses[0]).toMatchObject({ title: "Friends", restarts: 1 });
    // Friends has 1 distinct episode but keeps getting restarted: a relapse, not a burial
    expect(i.graveyard.map((g) => g.title)).toEqual(["Lupin"]);
  });
});

describe("computeInsights: hour heatmap", () => {
  it("sums minutes per weekday/hour and reports peak, late-night share and 3am minutes", () => {
    // 2024-03-04 is a Monday
    const i = timed([
      ep("A", 1, at(2024, 3, 4, 3, 10), { durationSeconds: 60 * 60 }),
      ep("A", 2, at(2024, 3, 10, 21), { durationSeconds: 30 * 60 }), // Sunday
      ep("A", 3, at(2024, 3, 6, 4, 50), { durationSeconds: 30 * 60 }), // Wednesday
    ])!.hourHeatmap!;
    expect(i.cells).toHaveLength(7);
    expect(i.cells[0]).toHaveLength(24);
    expect(i.cells[0][3]).toBe(60);
    expect(i.cells[6][21]).toBe(30);
    expect(i.cells[2][4]).toBe(30);
    expect(i.peakDay).toBe("Mon");
    expect(i.peakHour).toBe(3);
    expect(i.lateNightShare).toBe(75);
    expect(i.threeAmMinutes).toBe(60);
  });
});

describe("computeInsights: devices, countries, profiles", () => {
  it("groups by name, skips blanks, counts title-day sessions, sorts by seconds", () => {
    const i = timed([
      ep("A", 1, at(2024, 1, 1, 20), { deviceType: "TV", country: "US (United States)", profileName: "Alex" }),
      ep("A", 1, at(2024, 1, 1, 21), { deviceType: "TV", country: "US (United States)", profileName: "Alex" }), // resume
      ep("A", 2, at(2024, 2, 1, 20), { deviceType: "TV", country: "US (United States)", profileName: "Alex" }),
      ep("B", 1, at(2024, 1, 5, 20), { deviceType: "Phone", country: "GB (United Kingdom)", profileName: "Sam" }),
      ep("B", 2, at(2024, 1, 6, 20), { deviceType: "", country: undefined, profileName: "" }),
    ]);
    expect(i.devices).toEqual([
      { name: "TV", seconds: 3 * 2700, sessions: 2, firstSeen: "2024-01-01", lastSeen: "2024-02-01" },
      { name: "Phone", seconds: 2700, sessions: 1, firstSeen: "2024-01-05", lastSeen: "2024-01-05" },
    ]);
    expect(i.countries!.map((c) => c.name)).toEqual(["US (United States)", "GB (United Kingdom)"]);
    expect(i.profiles!.map((p) => p.name)).toEqual(["Alex", "Sam"]);
  });

  it("is null when every value is blank", () => {
    const i = timed([ep("A", 1, at(2024, 1, 1), { profileName: "" })]);
    expect(i.devices).toBeNull();
    expect(i.countries).toBeNull();
    expect(i.profiles).toBeNull();
  });
});

describe("computeInsights: sharing", () => {
  const play = (device: string, start: Date, minutes: number, title = "A: Season 1: Episode 1") =>
    makeEntry({ title, startTime: start, durationSeconds: minutes * 60, deviceType: device, country: "US (United States)" });

  it("flags two devices overlapping by 5+ minutes, with a dated sentence", () => {
    const i = timed([
      play("TV", at(2024, 3, 3, 20), 60),
      play("Chrome PC", at(2024, 3, 3, 20, 30), 40, "B: Season 1: Episode 1"),
    ]);
    const s = i.sharing!.signals.find((x) => x.kind === "overlap")!;
    expect(s).toMatchObject({ count: 1, date: "2024-03-03" });
    expect(s.detail).toBe("Two devices were playing at the same time once, on 3 Mar 2024 (TV and Chrome PC).");
    expect(i.sharing!.suspicious).toBe(false);
  });

  it("counts occasions, reports the latest, and becomes suspicious at 3", () => {
    const entries = [1, 2, 3].flatMap((d) => [
      play("TV", at(2024, 3, d, 20), 60),
      play("Chrome PC", at(2024, 3, d, 20, 10), 30, "B: Season 1: Episode 1"),
      play("Chrome PC", at(2024, 3, d, 20, 41), 10, "B: Season 1: Episode 2"), // same occasion
    ]);
    const i = timed(entries);
    const s = i.sharing!.signals[0];
    expect(s.kind).toBe("overlap");
    expect(s.count).toBe(3);
    expect(s.detail).toBe(
      "Two devices were playing at the same time on 3 occasions, most recently 3 Mar 2024 (TV and Chrome PC)."
    );
    expect(i.sharing!.suspicious).toBe(true);
  });

  it("ignores overlaps on the same device and overlaps under 5 minutes", () => {
    const i = timed([
      play("TV", at(2024, 3, 3, 20), 60),
      play("TV", at(2024, 3, 3, 20, 30), 60),
      play("Phone", at(2024, 3, 3, 21, 26), 30), // overlaps the second TV play by 4 min
    ]);
    expect(i.sharing!.signals.filter((s) => s.kind === "overlap")).toEqual([]);
  });

  it("flags plays from a country other than the main one", () => {
    const entries = [
      ...[1, 2, 3, 4].map((d) => play("TV", at(2024, 1, d, 20), 60)),
      { ...play("TV", at(2024, 2, 1, 20), 50), country: "GB (United Kingdom)" },
      { ...play("TV", at(2024, 2, 4, 20), 50, "B: Season 1: Episode 1"), country: "GB (United Kingdom)" },
    ];
    const i = timed(entries);
    const s = i.sharing!.signals.find((x) => x.kind === "foreign-country")!;
    expect(s).toMatchObject({ count: 2, date: "2024-02-04" });
    expect(s.detail).toContain("2 plays were logged in GB (United Kingdom), between 1 Feb 2024 and 4 Feb 2024.");
    expect(i.sharing!.suspicious).toBe(true);
  });

  it("flags a device seen once or twice only when the main device has 20+ sessions", () => {
    const main = Array.from({ length: 20 }, (_, k) => play("TV", at(2024, 1, k + 1, 20), 45, `A: Season 1: Episode ${k}`));
    const oneOff = play("Hotel TV", at(2024, 2, 10, 20), 45, "B: Season 1: Episode 1");
    const i = timed([...main, oneOff]);
    const s = i.sharing!.signals.find((x) => x.kind === "one-off-device")!;
    expect(s).toMatchObject({ count: 1, date: "2024-02-10" });
    expect(s.detail).toBe("Hotel TV showed up for a single play on 10 Feb 2024 and never again.");
    expect(i.sharing!.suspicious).toBe(false);

    const fewer = timed([...main.slice(0, 19), oneOff]);
    expect(fewer.sharing!.signals.some((x) => x.kind === "one-off-device")).toBe(false);
  });
});

describe("computeInsights: rich full export, end to end", () => {
  const stats = computeWrappedStats(parseNetflixCSV(loadFixture("full-export-rich.csv")));
  const i = stats.insights!;

  it("finds Friends restarted from the pilot and the rewatched movie", () => {
    expect(stats.hasTimeData).toBe(true);
    const friends = i.relapses.find((r) => r.title === "Friends")!;
    expect(friends).toMatchObject({ kind: "show", restarts: 4, rewatchedEpisodes: 3 });
    expect(friends.timeline).toEqual(["2022-01-10", "2022-06-01", "2023-01-15", "2023-09-01", "2024-05-01"]);
    expect(i.relapses[0].title).toBe("Friends");
    const movie = i.relapses.find((r) => r.title === "The Grand Budapest Hotel")!;
    expect(movie).toMatchObject({ kind: "movie", restarts: 3 });
  });

  it("buries the shows abandoned early", () => {
    expect(i.graveyard.map((g) => g.title)).toEqual(["The Crown", "Ozark", "Squid Game", "Lupin"]);
    expect(i.graveyardCount).toBe(4);
    expect(i.firstWatched).toBe("2022-01-10");
    expect(i.monthsSpanned).toBeGreaterThanOrEqual(24);
  });

  it("fills the late-night report, devices, countries and profiles", () => {
    expect(i.hourHeatmap!.lateNightShare).toBeGreaterThan(20);
    expect(i.hourHeatmap!.threeAmMinutes).toBeGreaterThan(0);
    expect(i.devices!.map((d) => d.name)).toEqual([
      "Samsung 2019 TV (Tizen)",
      "Chrome PC (Cadmium)",
      "Apple iPhone 12 (iOS)",
    ]);
    expect(i.countries!.map((c) => c.name)).toEqual(["US (United States)", "GB (United Kingdom)"]);
    expect(i.profiles!.map((p) => p.name).sort()).toEqual(["Alex", "Sam"]);
  });

  it("raises every kind of sharing signal", () => {
    const kinds = i.sharing!.signals.map((s) => s.kind);
    expect(kinds).toEqual(["overlap", "foreign-country", "one-off-device"]);
    expect(i.sharing!.signals[0]).toMatchObject({ count: 4, date: "2024-06-15" });
    expect(i.sharing!.suspicious).toBe(true);
  });
});
