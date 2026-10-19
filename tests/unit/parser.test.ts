import { describe, expect, it } from "vitest";
import { CSVParseError, parseNetflixCSV } from "@/lib/csv/parser";
import { loadFixture } from "../fixtures";

const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

describe("parseNetflixCSV: quick export (Title,Date)", () => {
  const entries = parseNetflixCSV(loadFixture("quick-us-mdy.csv"));

  it("drops blank-title rows and keeps every other row", () => {
    expect(entries).toHaveLength(11);
    expect(entries.every((e) => e.title.length > 0)).toBe(true);
  });

  it("parses US M/D/YY dates at local noon", () => {
    const first = entries[0];
    expect(ymd(first.startTime)).toEqual([2024, 3, 15]);
    expect(first.startTime.getHours()).toBe(12);
    const irishman = entries.find((e) => e.title === "The Irishman")!;
    expect(ymd(irishman.startTime)).toEqual([2023, 12, 31]);
  });

  it("collapses a quoted title with an embedded newline into one line", () => {
    expect(entries.map((e) => e.title)).toContain("Glass Onion");
    expect(entries.some((e) => /\n/.test(e.title))).toBe(false);
  });

  it("marks every entry as timeEstimated with blank profile/device fields", () => {
    for (const e of entries) {
      expect(e.timeEstimated).toBe(true);
      expect(e.profileName).toBe("");
      expect(e.deviceType).toBe("");
      expect(e.supplementalVideoType).toBe("");
    }
  });

  it("estimates 40 minutes for episodes and 110 minutes for movies", () => {
    const dur = (title: string) => entries.find((e) => e.title === title)!.durationSeconds;
    expect(dur("Stranger Things: Stranger Things 4: Chapter One: The Hellfire Club")).toBe(40 * 60);
    expect(dur("Mission: Impossible")).toBe(110 * 60);
    expect(dur("The Irishman")).toBe(110 * 60);
    expect(dur("Glass Onion")).toBe(110 * 60);
    // No season markers, but the shared "Outside" prefix appears twice: a series
    expect(dur("Outside: The Deal")).toBe(40 * 60);
    expect(dur("Outside: Time's Up")).toBe(40 * 60);
  });

  it("treats a single title with an episode keyword as an episode", () => {
    const [e] = parseNetflixCSV('Title,Date\n"Lone Show: Season 1: Pilot","1/2/24"\n');
    expect(e.durationSeconds).toBe(40 * 60);
  });
});

describe("parseNetflixCSV: date order detection", () => {
  it("switches to D/M/YY when any first component exceeds 12", () => {
    const entries = parseNetflixCSV(loadFixture("quick-dmy.csv"));
    expect(entries.map((e) => ymd(e.startTime))).toEqual([
      [2023, 12, 25],
      [2024, 1, 3],
      [2024, 2, 13],
    ]);
  });

  it("defaults to M/D/YY when every date is ambiguous", () => {
    const [e] = parseNetflixCSV("Title,Date\nRoma,3/1/24\n");
    expect(ymd(e.startTime)).toEqual([2024, 3, 1]);
  });

  it("accepts 4-digit years and dot/dash separators", () => {
    const entries = parseNetflixCSV("Title,Date\nA,1.2.2024\nB,25-12-2023\n");
    // 25 forces day-first for the whole file
    expect(entries.map((e) => ymd(e.startTime))).toEqual([
      [2024, 2, 1],
      [2023, 12, 25],
    ]);
  });

  it("drops rows whose dates are unparseable or impossible", () => {
    const entries = parseNetflixCSV("Title,Date\nA,not a date\nB,2/30/24\nC,1/2/24\n");
    expect(entries.map((e) => e.title)).toEqual(["C"]);
  });

  it("parses ISO YYYY-MM-DD and rejects impossible ISO dates", () => {
    const entries = parseNetflixCSV(loadFixture("quick-iso.csv"));
    expect(entries.map((e) => [e.title, ...ymd(e.startTime)])).toEqual([
      ["Dark: Season 1: Secrets", 2024, 3, 15],
      ["Roma", 2024, 2, 29],
    ]);
  });
});

describe("parseNetflixCSV: BOM and headers", () => {
  it("strips a UTF-8 BOM so the Title header is recognised", () => {
    const text = loadFixture("bom-quick.csv");
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const entries = parseNetflixCSV(text);
    expect(entries.map((e) => e.title)).toEqual(["Roma", "Dark: Season 1: Secrets"]);
  });

  it("tolerates whitespace around header names", () => {
    const entries = parseNetflixCSV(" Title , Date \nRoma,2/13/24\n");
    expect(entries).toHaveLength(1);
  });

  it("throws CSVParseError with guidance for unknown headers", () => {
    const run = () => parseNetflixCSV(loadFixture("invalid-headers.csv"));
    expect(run).toThrow(CSVParseError);
    expect(run).toThrow(/Expected columns "Title, Date" or "Title, Start Time, Duration"/);
    expect(run).toThrow(/netflix\.com\/viewingactivity/);
    expect(() => run()).toThrow(expect.objectContaining({ name: "CSVParseError" }));
  });

  it("throws CSVParseError for an empty file", () => {
    expect(() => parseNetflixCSV(loadFixture("empty.csv"))).toThrow(CSVParseError);
  });

  it("returns no entries for a valid header with no rows", () => {
    expect(parseNetflixCSV("Title,Date\n")).toEqual([]);
  });
});

describe("parseNetflixCSV: full data-request export", () => {
  const entries = parseNetflixCSV(loadFixture("full-export.csv"));

  it("keeps rows with a valid start time and non-zero duration (trailers included)", () => {
    const titles = entries.map((e) => e.title);
    expect(titles).not.toContain("Broken Row");
    expect(titles).not.toContain("Zero Duration");
    expect(titles).toContain("Dark: Season 2 (Trailer)");
    expect(entries).toHaveLength(10);
  });

  it("parses HH:MM:SS durations exactly", () => {
    const glass = entries.filter((e) => e.title === "Glass Onion").map((e) => e.durationSeconds);
    expect(glass.sort((a, b) => a - b)).toEqual([30, 2 * 3600 + 19 * 60]);
  });

  it("keeps real start times, profile, device and supplemental type", () => {
    const lies = entries.find((e) => e.title === "Dark: Season 1: Lies")!;
    expect(ymd(lies.startTime)).toEqual([2024, 3, 15]);
    expect(lies.startTime.getHours()).toBe(22);
    expect(lies.profileName).toBe("Alex");
    expect(lies.deviceType).toBe("Chrome PC (Cadmium)");
    expect(lies.timeEstimated).toBeUndefined();
    const trailer = entries.find((e) => e.supplementalVideoType === "TRAILER")!;
    expect(trailer.durationSeconds).toBe(90);
  });

  it("keeps quoted titles containing commas whole", () => {
    expect(entries.map((e) => e.title)).toContain("Love, Death & Robots: Volume 1: Zima Blue");
  });

  it("prefers the full format when both header sets are present", () => {
    const [e] = parseNetflixCSV("Title,Date,Start Time,Duration\nX,1/2/24,2024-01-02 10:00:00,01:00:00\n");
    expect(e.durationSeconds).toBe(3600);
    expect(e.timeEstimated).toBeUndefined();
  });

  it("drops rows with malformed durations", () => {
    const rows = parseNetflixCSV(
      "Title,Start Time,Duration\nX,2024-01-02 10:00:00,45:00\nY,2024-01-02 10:00:00,aa:bb:cc\n"
    );
    expect(rows).toEqual([]);
  });
});
