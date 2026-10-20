import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import {
  MAX_REQUEST_BYTES,
  MAX_STORED_BYTES,
  WrappedDataSchema,
  buildOwnerTeaser,
  clientIp,
  clientKey,
  readJson,
} from "@/app/api/groups/_lib/wrapped";
import { computeWrappedStats } from "@/lib/csv/stats";
import { parseNetflixCSV } from "@/lib/csv/parser";
import { loadFixture } from "../fixtures";

/** Real stats, serialised the way the client sends them (Dates become strings). */
function wireStats(fixture: string) {
  return JSON.parse(JSON.stringify(computeWrappedStats(parseNetflixCSV(loadFixture(fixture)))));
}

describe("WrappedDataSchema", () => {
  it("accepts real stats and keeps the summary fields", () => {
    const input = wireStats("quick-us-mdy.csv");
    const out = WrappedDataSchema.parse(input);
    for (const key of [
      "totalSeconds",
      "totalHours",
      "totalDays",
      "mostLoyalShow",
      "nightOwlScore",
      "dayHeatmap",
      "dayTitleCounts",
      "personality",
      "personalityDescription",
      "funComparison",
      "peakHour",
      "uniqueShowsCount",
      "totalEpisodesEstimate",
      "hasTimeData",
      "weeksSpanned",
      "distinctTitleDays",
    ] as const) {
      expect(out[key]).toEqual(input[key]);
    }
    expect(out.topShows).toEqual(input.topShows);
    expect(out.topShows[2]).toMatchObject({ title: "Mission: Impossible", kind: "movie" });
  });

  it("strips per-title lists: allBingeSessions and longestBinge.titles", () => {
    const input = wireStats("full-export.csv");
    expect(input.allBingeSessions.length).toBeGreaterThan(0);
    const out = WrappedDataSchema.parse(input);
    expect(out.allBingeSessions).toEqual([]);
    expect(out.longestBinge.titles).toEqual([]);
    expect(out.longestBinge.titleCount).toBe(4);
    expect(out.longestBinge.totalSeconds).toBe(input.longestBinge.totalSeconds);
  });

  it("derives titleCount from titles for older stats without it", () => {
    const input = wireStats("full-export.csv");
    input.longestBinge = { ...input.longestBinge, titleCount: undefined, titles: ["A", "B", "C"] };
    expect(WrappedDataSchema.parse(input).longestBinge.titleCount).toBe(3);
  });

  it("drops unknown keys and caps topShows at 5", () => {
    const input = wireStats("quick-us-mdy.csv");
    input.rawCsv = "secret";
    input.topShows = Array.from({ length: 10 }, (_, i) => ({ title: `S${i}`, watchCount: 1, totalSeconds: 1 }));
    const out = WrappedDataSchema.parse(input) as Record<string, unknown>;
    expect(out.rawCsv).toBeUndefined();
    expect((out.topShows as unknown[]).length).toBe(5);
  });

  it("rejects invalid shapes", () => {
    const base = wireStats("quick-us-mdy.csv");
    const bad = (patch: Record<string, unknown>) => WrappedDataSchema.safeParse({ ...base, ...patch }).success;
    expect(bad({ personality: "The Hacker" })).toBe(false);
    expect(bad({ nightOwlScore: 101 })).toBe(false);
    expect(bad({ peakHour: 24 })).toBe(false);
    expect(bad({ totalSeconds: -1 })).toBe(false);
    expect(bad({ topShows: Array.from({ length: 11 }, () => base.topShows[0]) })).toBe(false);
    expect(bad({ distinctTitleDays: 1.5 })).toBe(false);
    expect(bad({ personalityDescription: "x".repeat(401) })).toBe(false);
  });

  it("worst-case valid summaries stay under MAX_STORED_BYTES", () => {
    const input = wireStats("quick-us-mdy.csv");
    input.topShows = Array.from({ length: 5 }, (_, i) => ({ title: `${i}`.padEnd(200, "x"), watchCount: 1, totalSeconds: 1 }));
    input.mostLoyalShow = input.topShows[0];
    input.personalityDescription = "y".repeat(400);
    input.funComparison = "z".repeat(400);
    expect(JSON.stringify(WrappedDataSchema.parse(input)).length).toBeLessThan(MAX_STORED_BYTES);
    // A real summary is tiny
    expect(JSON.stringify(WrappedDataSchema.parse(wireStats("full-export.csv"))).length).toBeLessThan(4000);
  });
});

describe("buildOwnerTeaser", () => {
  it("leads with the exact title count for date-only exports", () => {
    const s = WrappedDataSchema.parse(wireStats("quick-us-mdy.csv"));
    expect(buildOwnerTeaser(s)).toEqual({
      personality: "The Casual Viewer",
      statValue: "11",
      statLabel: "titles watched, about 11 hours",
    });
  });

  it("treats a missing hasTimeData as date-only and singularises one title", () => {
    const s = WrappedDataSchema.parse({ ...wireStats("quick-us-mdy.csv"), hasTimeData: undefined, distinctTitleDays: 1 });
    expect(buildOwnerTeaser(s)).toMatchObject({ statValue: "1", statLabel: "title watched, about 11 hours" });
    const old = WrappedDataSchema.parse({ ...wireStats("quick-us-mdy.csv"), distinctTitleDays: undefined, totalEpisodesEstimate: 1234 });
    expect(buildOwnerTeaser(old).statValue).toBe("1,234");
  });

  it("leads with hours for timed exports", () => {
    const s = WrappedDataSchema.parse(wireStats("full-export.csv"));
    expect(buildOwnerTeaser(s)).toEqual({ personality: "The Weekend Warrior", statValue: "5h", statLabel: "of Netflix watched" });
  });

  it("adds a trimmed nickname, and leaves out blanks, the \"Me\" placeholder and over-long names", () => {
    const s = WrappedDataSchema.parse(wireStats("full-export.csv"));
    expect(buildOwnerTeaser(s, "  Sam ")).toMatchObject({ nickname: "Sam", personality: "The Weekend Warrior" });
    for (const name of [undefined, null, "", "   ", "Me", "me", "n".repeat(31)]) {
      expect(buildOwnerTeaser(s, name)).not.toHaveProperty("nickname");
    }
  });

  it("stores the renamed Genre Surfer personality under its new name", () => {
    const s = WrappedDataSchema.parse({ ...wireStats("full-export.csv"), personality: "The Genre Surfer" });
    expect(s.personality).toBe("The Channel Surfer");
    expect(buildOwnerTeaser(s).personality).toBe("The Channel Surfer");
  });
});

describe("readJson", () => {
  const req = (body: string, headers: Record<string, string> = {}) =>
    new Request("http://x.test/api", { method: "POST", body, headers }) as unknown as NextRequest;

  it("parses a JSON body", async () => {
    await expect(readJson(req('{"a":1}'))).resolves.toEqual({ ok: true, body: { a: 1 } });
  });

  it("rejects invalid JSON with 400", async () => {
    await expect(readJson(req("{nope"))).resolves.toMatchObject({ ok: false, status: 400 });
  });

  it("rejects an oversized declared length or body with 413", async () => {
    await expect(readJson(req("{}", { "content-length": String(MAX_REQUEST_BYTES + 1) }))).resolves.toMatchObject({
      ok: false,
      status: 413,
    });
    await expect(readJson(req(`"${"x".repeat(MAX_REQUEST_BYTES)}"`))).resolves.toMatchObject({ ok: false, status: 413 });
  });
});

describe("clientIp / clientKey", () => {
  const withHeaders = (h: Record<string, string>) => ({ headers: new Headers(h) }) as unknown as NextRequest;

  it("prefers x-real-ip, then the first x-forwarded-for hop", () => {
    expect(clientIp(withHeaders({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(withHeaders({ "x-forwarded-for": " 3.3.3.3 , 4.4.4.4" }))).toBe("3.3.3.3");
    expect(clientIp(withHeaders({}))).toBe("unknown");
  });

  it("hashes the IP so the raw value never leaves", () => {
    const key = clientKey(withHeaders({ "x-real-ip": "1.1.1.1" }));
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain("1.1.1.1");
    expect(clientKey(withHeaders({ "x-real-ip": "1.1.1.1" }))).toBe(key);
    expect(clientKey(withHeaders({ "x-real-ip": "1.1.1.2" }))).not.toBe(key);
  });
});
