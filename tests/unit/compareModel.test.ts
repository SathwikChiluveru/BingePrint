import { describe, expect, it } from "vitest";
import {
  buildComparison,
  cardPunchline,
  listNames,
  memberRoast,
  rankMembers,
  unitLabel,
  type Comparison,
} from "@/components/compare/compareModel";
import type { GroupMember, WrappedStats } from "@/types";
import { makeStats } from "../fixtures";

let n = 0;
function member(nickname: string, data: Partial<WrappedStats>, userId: string | null = nickname.toLowerCase()): GroupMember {
  n++;
  return {
    id: `m${n}`,
    group_id: "g1",
    user_id: userId,
    nickname,
    wrapped_data: makeStats(data),
    created_at: "2024-01-01T00:00:00Z",
  };
}

const timed = (hours: number, extra: Partial<WrappedStats> = {}) =>
  ({ hasTimeData: true, totalHours: hours, totalEpisodesEstimate: hours * 2, distinctTitleDays: hours, ...extra });
const dateOnly = (titles: number, extra: Partial<WrappedStats> = {}) =>
  ({ hasTimeData: false, totalHours: titles, totalEpisodesEstimate: titles, distinctTitleDays: titles, ...extra });

/** Every user-facing string in a comparison, for copy checks. */
function allCopy(c: Comparison): string[] {
  return [
    c.headline,
    c.punchline,
    cardPunchline(c),
    c.nightOwlNote ?? "",
    ...c.superlatives.map((s) => s.detail),
    ...c.ranked.map((r) => r.roast),
  ];
}

describe("rankMembers: metric choice", () => {
  it("ranks by hours when every member has real watch times", () => {
    const { metric, ranked } = rankMembers([member("Ann", timed(10)), member("Bob", timed(30))], null);
    expect(metric).toBe("hours");
    expect(ranked.map((r) => [r.member.nickname, r.value])).toEqual([
      ["Bob", 30],
      ["Ann", 10],
    ]);
  });

  it("ranks everyone by titles when any member is date-only", () => {
    // Bob has more hours but Ann has more titles
    const { metric, ranked } = rankMembers([member("Ann", dateOnly(50)), member("Bob", timed(100, { distinctTitleDays: 40 }))], null);
    expect(metric).toBe("titles");
    expect(ranked.map((r) => [r.member.nickname, r.value])).toEqual([
      ["Ann", 50],
      ["Bob", 40],
    ]);
  });

  it("treats a missing hasTimeData flag as date-only", () => {
    const { metric } = rankMembers([member("Ann", timed(10)), member("Old", { hasTimeData: undefined, totalEpisodesEstimate: 3 })], null);
    expect(metric).toBe("titles");
  });

  it("falls back to totalEpisodesEstimate when distinctTitleDays is absent", () => {
    const { ranked } = rankMembers(
      [member("Ann", dateOnly(5, { distinctTitleDays: undefined, totalEpisodesEstimate: 12 })), member("Bob", dateOnly(7))],
      null
    );
    expect(ranked.map((r) => [r.member.nickname, r.value])).toEqual([
      ["Ann", 12],
      ["Bob", 7],
    ]);
  });

  it("shares ranks on ties (1, 1, 3) and orders ties by nickname", () => {
    const { ranked } = rankMembers([member("Zed", timed(10)), member("Amy", timed(10)), member("Cat", timed(4))], null);
    expect(ranked.map((r) => [r.member.nickname, r.rank])).toEqual([
      ["Amy", 1],
      ["Zed", 1],
      ["Cat", 3],
    ]);
  });

  it("computes bar share against the leader and marks me", () => {
    const { ranked } = rankMembers([member("Ann", timed(10)), member("Bob", timed(40))], "ann");
    expect(ranked.find((r) => r.isMe)?.member.nickname).toBe("Ann");
    expect(ranked.map((r) => r.share)).toEqual([1, 0.25]);
  });

  it("handles zero members and an all-zero board without NaN", () => {
    expect(rankMembers([], null).ranked).toEqual([]);
    const { ranked } = rankMembers([member("Ann", dateOnly(0)), member("Bob", dateOnly(0))], null);
    expect(ranked.every((r) => r.share === 0 && r.rank === 1)).toBe(true);
  });
});

describe("buildComparison: headlines and punchlines", () => {
  it("I lead: names the margin", () => {
    const c = buildComparison([member("Me", timed(50)), member("Bob", timed(20))], "me");
    expect(c.headline).toBe("You out-watched everyone.");
    expect(c.punchline).toBe("By 30 hours. Nobody is proud of you.");
    expect(c.gap).toBe(30);
    expect(c.runnerUp?.member.nickname).toBe("Bob");
  });

  it("I tie for first: dead even, nobody gets the crown", () => {
    const c = buildComparison([member("Me", dateOnly(12)), member("Bob", dateOnly(12))], "me");
    expect(c.headline).toBe("You and Bob are dead even at 12 titles.");
    expect(c.punchline).toBe("Equally guilty. Nobody gets the crown.");
    expect(c.gap).toBe(0);
    expect(cardPunchline(c)).toBe("Equally guilty. Nobody gets the crown.");
  });

  it("I am close behind", () => {
    const c = buildComparison([member("Me", timed(99)), member("Bob", timed(100))], "me");
    expect(c.headline).toBe("Bob out-watched you by 1 hour.");
    expect(c.punchline).toBe("That close. One rainy weekend and the crown is yours.");
  });

  it("I am 3x or more behind", () => {
    const c = buildComparison([member("Me", timed(10)), member("Bob", timed(35))], "me");
    expect(c.punchline).toBe("That is 3x more than you. Someone check on Bob.");
    expect(cardPunchline(c)).toBe("3x more than Me. Someone check on Bob.");
  });

  it("I am behind, but not by much", () => {
    const c = buildComparison([member("Me", timed(60)), member("Bob", timed(100))], "me");
    expect(c.punchline).toBe("You still watched 60 hours. Losing here is not the flex you think.");
    expect(cardPunchline(c)).toBe("Me came second. Still not a flex.");
  });

  it("I logged 0 titles: dedicated copy, never 'infinitely' or Infinity", () => {
    const c = buildComparison([member("Me", dateOnly(0)), member("Bob", dateOnly(25))], "me");
    expect(c.headline).toBe("Bob out-watched you by 25 titles.");
    expect(c.punchline).toBe("You logged nothing. Either you have a life or you uploaded the wrong file.");
    expect(cardPunchline(c)).toBe("Me logged nothing. Bob watched enough for both.");
    for (const s of allCopy(c)) {
      expect(s).not.toMatch(/infinit|NaN|undefined/i);
    }
  });

  it("card punchline for a close race", () => {
    const c = buildComparison([member("Ann", timed(100)), member("Bob", timed(97))], null);
    expect(cardPunchline(c)).toBe("One rainy weekend could flip this.");
  });

  it("viewer not on the board", () => {
    const c = buildComparison([member("Ann", timed(30)), member("Bob", timed(10))], "someone-else");
    expect(c.me).toBeNull();
    expect(c.headline).toBe("Ann out-watched everyone by 20 hours.");
    expect(c.punchline).toBe("Your reel isn't on the board yet. Add it and get roasted too.");

    const tie = buildComparison([member("Ann", timed(10)), member("Bob", timed(10))], null);
    expect(tie.headline).toBe("Ann and Bob are dead even.");

    const solo = buildComparison([member("Ann", timed(10))], null);
    expect(solo.headline).toBe("Ann is the only one on the board.");
    expect(cardPunchline(solo)).toBe("Ann has nobody to lose to yet.");
  });

  it("uses singular units", () => {
    expect(unitLabel("titles", 1)).toBe("title");
    expect(unitLabel("hours", 1)).toBe("hour");
    expect(unitLabel("hours", 2)).toBe("hours");
  });
});

describe("buildComparison: superlatives and notes", () => {
  const binge = (titleCount: number, totalSeconds: number) => ({
    startTime: "2024-03-15T12:00:00.000Z" as unknown as Date,
    endTime: "2024-03-15T18:00:00.000Z" as unknown as Date,
    totalSeconds,
    showCount: 1,
    titles: [],
    titleCount,
  });

  it("date-only boards get Most loyal + Biggest single day in titles, no night owl", () => {
    const c = buildComparison(
      [
        member("Ann", dateOnly(30, { topShows: [{ title: "Friends", watchCount: 20, totalSeconds: 1 }], longestBinge: binge(9, 3600) })),
        member("Bob", dateOnly(20, { topShows: [{ title: "Dark", watchCount: 1, totalSeconds: 1 }], longestBinge: binge(3, 99999) })),
      ],
      "bob"
    );
    expect(c.allDateOnly).toBe(true);
    expect(c.dateOnlyNames).toEqual(["Ann", "Bob"]);
    expect(c.superlatives.map((s) => s.key)).toEqual(["loyal", "day"]);
    expect(c.superlatives[0]).toMatchObject({ name: "Ann", detail: "Friends, 20 times", isMe: false });
    expect(c.superlatives[1]).toMatchObject({ label: "Biggest single day", name: "Ann" });
    expect(c.superlatives[1].detail).toMatch(/^9 titles on Mar 15$/);
    expect(c.nightOwlNote).toBe("Night owl needs two people whose exports include watch times.");
  });

  it("timed boards get Longest binge in hours and Night owl", () => {
    const c = buildComparison(
      [
        member("Ann", timed(30, { nightOwlScore: 70, longestBinge: binge(3, 5 * 3600) })),
        member("Bob", timed(20, { nightOwlScore: 10, longestBinge: binge(9, 2.5 * 3600) })),
      ],
      "ann"
    );
    const day = c.superlatives.find((s) => s.key === "day")!;
    expect(day).toMatchObject({ label: "Longest binge", name: "Ann", isMe: true });
    expect(day.detail).toMatch(/^5h straight on Mar 15$/);
    const owl = c.superlatives.find((s) => s.key === "owl")!;
    expect(owl).toMatchObject({ name: "Ann", detail: "70% of viewing starts between 10pm and 4am" });
    expect(c.nightOwlNote).toBeNull();
  });

  it("mixed boards with 2+ timed members name who night owl leaves out", () => {
    const c = buildComparison(
      [member("Ann", timed(30, { nightOwlScore: 50 })), member("Bob", timed(20, { nightOwlScore: 40 })), member("Cy", dateOnly(5))],
      null
    );
    expect(c.metric).toBe("titles");
    expect(c.nightOwlNote).toBe("Night owl leaves out Cy: no watch times in that export.");
  });

  it("flags old timed stats without distinctTitleDays as inflated on a titles board", () => {
    const c = buildComparison(
      [member("Old", timed(30, { distinctTitleDays: undefined })), member("Cy", dateOnly(5))],
      null
    );
    expect(c.inflatedNames).toEqual(["Old"]);
    const hoursBoard = buildComparison([member("Old", timed(30, { distinctTitleDays: undefined })), member("B", timed(2))], null);
    expect(hoursBoard.inflatedNames).toEqual([]);
  });

  it("omits superlatives nobody qualifies for", () => {
    const c = buildComparison([member("Ann", dateOnly(0)), member("Bob", dateOnly(0))], null);
    expect(c.superlatives).toEqual([]);
  });
});

describe("memberRoast", () => {
  it("combines personality jab, top show and biggest day", () => {
    const roast = memberRoast(
      makeStats({
        hasTimeData: false,
        personality: "The Loyalist",
        topShows: [{ title: "Friends", watchCount: 1, totalSeconds: 1 }],
        longestBinge: { startTime: new Date(2024, 2, 15, 12), endTime: new Date(2024, 2, 15, 13), totalSeconds: 1, showCount: 1, titles: [], titleCount: 1 },
      })
    );
    expect(roast).toBe("The Loyalist. Same show, forever. Pressed play on Friends 1 time. 1 title in one day on Mar 15.");
  });

  it("uses hours for timed members and skips empty parts", () => {
    const roast = memberRoast(
      makeStats({
        hasTimeData: true,
        personality: "The Night Owl",
        longestBinge: { startTime: "bad" as unknown as Date, endTime: new Date(), totalSeconds: 3.25 * 3600, showCount: 1, titles: [] },
      })
    );
    expect(roast).toBe("The Night Owl. Sleep is a rumor. Sat through 3.3h straight.");
  });
});

describe("listNames", () => {
  it.each([
    [[], ""],
    [["A"], "A"],
    [["A", "B"], "A and B"],
    [["A", "B", "C"], "A, B, and C"],
  ])("%j", (names, expected) => {
    expect(listNames(names)).toBe(expected);
  });
});

describe("stored members from older builds", () => {
  it("upgrades the old Genre Surfer label and Casual Viewer line before ranking and roasting", async () => {
    const { upgradeMembers } = await import("@/components/compare/compareModel");
    const old = member("Ana", { personality: "The Genre Surfer" as WrappedStats["personality"] });
    const casual = member("Bo", {
      personality: "The Casual Viewer",
      personalityDescription: "1,234 titles, all-time. Netflix keeps asking.",
    });
    const fresh = member("Cy", {});
    const [a, b, c] = upgradeMembers([old, casual, fresh]);
    expect(a.wrapped_data.personality).toBe("The Channel Surfer");
    expect(b.wrapped_data.personalityDescription).not.toMatch(/all-time/);
    expect(c).toBe(fresh);
    const { ranked } = rankMembers([old, fresh], null);
    expect(ranked.find((r) => r.member.nickname === "Ana")?.roast).toMatch(/^The Channel Surfer\./);
  });
});
