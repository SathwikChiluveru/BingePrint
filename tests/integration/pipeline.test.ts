// CSV text -> parseNetflixCSV -> computeWrappedStats -> toGroupSummary -> JSON -> server
// WrappedDataSchema -> stored row -> compareModel. Synthetic data only.
import { describe, expect, it } from "vitest";
import { parseNetflixCSV } from "@/lib/csv/parser";
import { computeWrappedStats } from "@/lib/csv/stats";
import { toGroupSummary } from "@/lib/share/safety";
import { MAX_STORED_BYTES, WrappedDataSchema, buildOwnerTeaser } from "@/app/api/groups/_lib/wrapped";
import { buildComparison, rankMembers } from "@/components/compare/compareModel";
import type { GroupMember, WrappedStats } from "@/types";
import { dateOnlyCsv, overTheWire, timedCsv } from "./fixtures/csv";

function store(stats: WrappedStats) {
  // Exactly what the client sends and the server keeps
  return WrappedDataSchema.parse(overTheWire(toGroupSummary(stats)));
}

function member(id: string, nickname: string, wrapped: unknown): GroupMember {
  return {
    id: `m-${id}`,
    group_id: "00000000-0000-4000-8000-000000000001",
    user_id: id,
    nickname,
    wrapped_data: wrapped as WrappedStats,
    created_at: "2024-03-20T00:00:00.000Z",
  };
}

const timed = computeWrappedStats(parseNetflixCSV(timedCsv()));
const dateOnly = computeWrappedStats(parseNetflixCSV(dateOnlyCsv()));

describe("CSV to stats", () => {
  it("parses the timed export with real times and drops the trailer", () => {
    const entries = parseNetflixCSV(timedCsv());
    expect(entries.length).toBe(13);
    expect(entries.every((e) => !e.timeEstimated)).toBe(true);
    expect(timed.hasTimeData).toBe(true);
    // 13 rows minus the 2-minute trailer
    expect(timed.totalEpisodesEstimate).toBe(12);
    // The resumed episode is one title+day pair, and the second Heist viewing is another day
    expect(timed.distinctTitleDays).toBe(11);
    expect(timed.nightOwlScore).toBeGreaterThan(0);
    expect(timed.allBingeSessions.length).toBeGreaterThan(0);
  });

  it("parses the date-only export as estimated", () => {
    expect(dateOnly.hasTimeData).toBe(false);
    expect(dateOnly.totalEpisodesEstimate).toBe(15);
    expect(dateOnly.distinctTitleDays).toBe(15);
    expect(dateOnly.nightOwlScore).toBe(0);
    expect(dateOnly.topShows[0].title).toBe("Moss Kingdom");
  });
});

describe("summary stored by the server", () => {
  it.each([
    ["timed", timed],
    ["date-only", dateOnly],
  ])("%s: keeps only the summary", (_label, stats) => {
    const stored = store(stats);
    expect(stored.allBingeSessions).toEqual([]);
    expect(stored.longestBinge.titles).toEqual([]);
    // The title count survives even though the list is dropped
    expect(stored.longestBinge.titleCount).toBe(stats.longestBinge.titleCount ?? stats.longestBinge.titles.length);
    expect(stored.topShows.length).toBeLessThanOrEqual(5);
    expect(stored.hasTimeData).toBe(stats.hasTimeData);
    expect(stored.distinctTitleDays).toBe(stats.distinctTitleDays);
    expect(JSON.stringify(stored).length).toBeLessThanOrEqual(MAX_STORED_BYTES);
    // No per-session title or timestamp list anywhere in the stored blob
    const serialized = JSON.stringify(stored);
    for (const session of stats.allBingeSessions.slice(1)) {
      expect(serialized).not.toContain(session.startTime.toISOString());
    }
  });

  it("strips unknown keys a client tacks on", () => {
    const payload = { ...(overTheWire(toGroupSummary(timed)) as object), email: "x@example.test", rawCsv: "Title,Date" };
    const stored = WrappedDataSchema.parse(payload) as Record<string, unknown>;
    expect(stored.email).toBeUndefined();
    expect(stored.rawCsv).toBeUndefined();
  });

  it("rejects a bad personality or a negative total", () => {
    const base = overTheWire(toGroupSummary(timed)) as Record<string, unknown>;
    expect(WrappedDataSchema.safeParse({ ...base, personality: "The Hacker" }).success).toBe(false);
    expect(WrappedDataSchema.safeParse({ ...base, totalHours: -1 }).success).toBe(false);
  });

  it("builds the teaser from the summary: titles for date-only, hours for timed", () => {
    expect(buildOwnerTeaser(store(dateOnly)).statValue).toBe("15");
    expect(buildOwnerTeaser(store(dateOnly)).statLabel).toMatch(/^titles watched, about \d+ hours$/);
    expect(buildOwnerTeaser(store(timed)).statValue).toMatch(/^\d+h$/);
  });
});

describe("compare renders from stored summaries", () => {
  const mixed = [member("u-timed", "Timed", store(timed)), member("u-dates", "Dates", store(dateOnly))];

  it("ranks a mixed group by titles, never hours", () => {
    const c = buildComparison(mixed, "u-timed");
    expect(c.metric).toBe("titles");
    expect(c.ranked.map((r) => [r.member.nickname, r.value])).toEqual([
      ["Dates", 15],
      ["Timed", 11],
    ]);
    expect(c.me?.member.nickname).toBe("Timed");
    expect(c.headline).toBe("Dates out-watched you by 4 titles.");
    expect(c.dateOnlyNames).toEqual(["Dates"]);
    expect(c.allDateOnly).toBe(false);
    expect(c.inflatedNames).toEqual([]);
    // Only one timed member: no night-owl superlative, and a note saying why
    expect(c.superlatives.find((s) => s.key === "owl")).toBeUndefined();
    expect(c.nightOwlNote).toBe("Night owl needs two people whose exports include watch times.");
    // Titles metric: biggest single day, counted in titles
    const day = c.superlatives.find((s) => s.key === "day");
    expect(day?.label).toBe("Biggest single day");
    expect(day?.detail).toMatch(/^\d+ titles? on [A-Z][a-z]{2} \d+$/);
  });

  it("gives the same comparison from stored summaries as from full stats", () => {
    const fromFull = buildComparison(
      [member("u-timed", "Timed", timed), member("u-dates", "Dates", dateOnly)],
      "u-dates"
    );
    const fromStored = buildComparison(mixed, "u-dates");
    const shape = (c: typeof fromFull) => ({
      metric: c.metric,
      ranked: c.ranked.map((r) => [r.member.nickname, r.rank, r.value, r.roast]),
      headline: c.headline,
      punchline: c.punchline,
      superlatives: c.superlatives,
      nightOwlNote: c.nightOwlNote,
    });
    expect(shape(fromStored)).toEqual(shape(fromFull));
  });

  it("ranks an all-timed group by hours and names a night owl", () => {
    const quieter = store({ ...timed, totalSeconds: 3600, totalHours: 1, nightOwlScore: 10 });
    const c = buildComparison([member("a", "Owl", store(timed)), member("b", "Lark", quieter)], null);
    expect(c.metric).toBe("hours");
    expect(c.leader.member.nickname).toBe("Owl");
    expect(c.superlatives.find((s) => s.key === "owl")?.name).toBe("Owl");
    expect(c.nightOwlNote).toBeNull();
    expect(c.punchline).toBe("Your reel isn't on the board yet. Add it and get roasted too.");
  });

  it("treats an older summary without hasTimeData as date-only", () => {
    const legacy = { ...store(timed) } as Record<string, unknown>;
    delete legacy.hasTimeData;
    const { metric } = rankMembers([member("a", "Old", WrappedDataSchema.parse(legacy)), member("b", "New", store(timed))], null);
    expect(metric).toBe("titles");
  });
});
