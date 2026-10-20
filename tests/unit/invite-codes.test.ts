import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INVITE_CODE_MAX_LENGTH,
  INVITE_CODE_PLACEHOLDER,
  displayInviteCode,
  fetchMyGroups,
  isOwnerTeaser,
  isValidInviteCode,
  normalizeInviteCode,
} from "@/lib/supabase/groups";
import * as safety from "@/lib/share/safety";

describe("supabase/groups invite codes", () => {
  it.each(["abcd1234", "abcdef1234", "a1b2c3d4e"])("accepts %s", (code) => {
    expect(isValidInviteCode(code)).toBe(true);
  });

  it.each(["abc1234", "abcdef12345", "ABCD1234", "abcd-1234", "abcd 1234", "", "abcd123!"])("rejects %j", (code) => {
    expect(isValidInviteCode(code)).toBe(false);
  });

  it("normalizes case, whitespace and dashes people type", () => {
    expect(normalizeInviteCode("  K7MQ-4XHR 2P ")).toBe("k7mq4xhr2p");
    expect(normalizeInviteCode(null)).toBe("");
    expect(normalizeInviteCode(undefined)).toBe("");
    expect(isValidInviteCode(normalizeInviteCode("ABCD-1234"))).toBe(true);
  });

  it("displays codes uppercase", () => {
    expect(displayInviteCode("k7mq4xhr2p")).toBe("K7MQ4XHR2P");
  });

  it("placeholder is a valid code once normalized and avoids look-alikes", () => {
    expect(INVITE_CODE_PLACEHOLDER).toHaveLength(INVITE_CODE_MAX_LENGTH);
    expect(isValidInviteCode(normalizeInviteCode(INVITE_CODE_PLACEHOLDER))).toBe(true);
    expect(INVITE_CODE_PLACEHOLDER).not.toMatch(/[ILO01]/i);
  });

  it("isOwnerTeaser checks the three string fields", () => {
    expect(isOwnerTeaser({ personality: "x", statLabel: "y", statValue: "z" })).toBe(true);
    expect(isOwnerTeaser({ personality: "x", statLabel: "y" })).toBe(false);
    expect(isOwnerTeaser({ personality: 1, statLabel: "y", statValue: "z" })).toBe(false);
    expect(isOwnerTeaser(null)).toBe(false);
    expect(isOwnerTeaser("teaser")).toBe(false);
  });
});

describe("fetchMyGroups", () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubFetch = (impl: () => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(impl));

  it("returns groups on 200", async () => {
    const groups = [{ id: "g1", name: "Crew", invite_code: "abcd1234", memberCount: 2, ownedByMe: true, isMember: true }];
    stubFetch(async () => new Response(JSON.stringify({ groups }), { status: 200 }));
    await expect(fetchMyGroups()).resolves.toEqual({ ok: true, groups });
  });

  it.each([
    [401, "signed-out"],
    [429, "rate-limited"],
    [500, "failed"],
  ])("maps %i to %s", async (status, reason) => {
    stubFetch(async () => new Response("{}", { status }));
    await expect(fetchMyGroups()).resolves.toEqual({ ok: false, reason });
  });

  it("fails on a malformed body or network error, never throws", async () => {
    stubFetch(async () => new Response("not json", { status: 200 }));
    await expect(fetchMyGroups()).resolves.toEqual({ ok: false, reason: "failed" });
    stubFetch(async () => new Response(JSON.stringify({ groups: "nope" }), { status: 200 }));
    await expect(fetchMyGroups()).resolves.toEqual({ ok: false, reason: "failed" });
    stubFetch(async () => {
      throw new TypeError("network");
    });
    await expect(fetchMyGroups()).resolves.toEqual({ ok: false, reason: "failed" });
  });

  it("aborts after the timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          })
      )
    );
    await expect(fetchMyGroups({ timeoutMs: 5 })).resolves.toEqual({ ok: false, reason: "failed" });
  });
});

describe("share/safety", () => {
  it("validates codes of 8+ alphanumerics, any case, trimmed", () => {
    expect(safety.isValidInviteCode("abcd1234")).toBe(true);
    expect(safety.isValidInviteCode(" ABCD1234 ")).toBe(true);
    expect(safety.isValidInviteCode("abc123")).toBe(false);
    expect(safety.isValidInviteCode("abcd-1234")).toBe(false);
    expect(safety.isValidInviteCode(12345678)).toBe(false);
    expect(safety.isValidInviteCode(undefined)).toBe(false);
  });

  it("safeInviteCode trims and lowercases valid codes, else undefined", () => {
    expect(safety.safeInviteCode(" ABCD1234 ")).toBe("abcd1234");
    expect(safety.safeInviteCode("<script>")).toBeUndefined();
    expect(safety.safeInviteCode(null)).toBeUndefined();
  });

  it("toGroupSummary drops allBingeSessions and keeps everything else", () => {
    const stats = { totalHours: 5, longestBinge: { totalSeconds: 1 }, allBingeSessions: [{ titles: ["secret"] }] };
    const summary = safety.toGroupSummary(stats);
    expect(summary).toEqual({ totalHours: 5, longestBinge: { totalSeconds: 1 } });
    expect("allBingeSessions" in summary).toBe(false);
    // The input is not mutated
    expect(stats.allBingeSessions).toHaveLength(1);
  });

  const UA = {
    instagram:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0",
    facebook: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0.0]",
    fbIab: "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/440.0.0.0;]",
    whatsapp: "WhatsApp/2.24.1 A",
    line: "Mozilla/5.0 (iPhone) Mobile/15E148 Safari Line/13.0.0",
    snapchat: "Mozilla/5.0 (iPhone) Mobile/15E148 Snapchat/12.50.0.30",
    tiktok: "Mozilla/5.0 (iPhone) Mobile/15E148 musical_ly_32.0.0 BytedanceWebview/d8a21c6",
    tiktok2: "Mozilla/5.0 (Linux; Android 14) TikTok 32.0.0",
    gsa: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/300.0.0 Mobile/15E148 Safari/604.1",
    safari:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
    firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
    // "Line" inside another word must not match
    online: "Mozilla/5.0 Onlinebrowser/1.0",
  };

  it.each([
    ["instagram", true],
    ["facebook", true],
    ["fbIab", true],
    ["whatsapp", true],
    ["line", true],
    ["snapchat", true],
    ["tiktok", true],
    ["tiktok2", true],
    ["gsa", true],
    ["safari", false],
    ["chrome", false],
    ["firefox", false],
    ["online", false],
  ] as const)("isInAppBrowser(%s) is %s", (key, expected) => {
    expect(safety.isInAppBrowser(UA[key])).toBe(expected);
  });

  it("reads navigator.userAgent when no UA is passed", () => {
    vi.stubGlobal("navigator", { userAgent: UA.instagram });
    expect(safety.isInAppBrowser()).toBe(true);
    vi.stubGlobal("navigator", { userAgent: UA.chrome });
    expect(safety.isInAppBrowser()).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe("teaserNickname / cleanOwnerTeaser", () => {
  it("keeps a real name and drops blanks, the Me placeholder, over-long names and non-strings", async () => {
    const { teaserNickname } = await import("@/lib/supabase/groups");
    expect(teaserNickname("  Sam ")).toBe("Sam");
    for (const v of ["", "  ", "Me", "ME", "n".repeat(31), 5, null, undefined]) expect(teaserNickname(v)).toBeNull();
  });

  it("returns only the shown fields", async () => {
    const { cleanOwnerTeaser } = await import("@/lib/supabase/groups");
    const base = { personality: "The Loyalist", statLabel: "of Netflix watched", statValue: "9h" };
    expect(cleanOwnerTeaser({ ...base, nickname: "Sam", extra: 1 })).toEqual({ ...base, nickname: "Sam" });
    expect(cleanOwnerTeaser({ ...base, nickname: "Me" })).toEqual(base);
    expect(cleanOwnerTeaser({ personality: "x" })).toBeNull();
  });
});

describe("group edit helpers (renameGroup, updateNickname, leaveGroup)", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(status: number, body: unknown) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const ID = "3f0c8a52-6b1e-4c7a-9d2e-1a2b3c4d5e6f";

  it("renameGroup PATCHes a trimmed name and returns the stored one", async () => {
    const { renameGroup } = await import("@/lib/supabase/groups");
    const fetchMock = stubFetch(200, { id: ID, name: "Sofa Society" });
    expect(await renameGroup(ID, "  Sofa Society ")).toEqual({ ok: true, name: "Sofa Society" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/groups/${ID}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ name: "Sofa Society" });
  });

  it.each([
    [403, /Only the person who started/],
    [422, /1 to 60/],
    [429, /Wait a few minutes/],
    [500, /old name is still there/],
  ])("renameGroup maps %i to owned copy", async (status, message) => {
    const { renameGroup } = await import("@/lib/supabase/groups");
    stubFetch(status, { error: "raw server text" });
    const result = await renameGroup(ID, "x");
    expect(result).toMatchObject({ ok: false, status });
    if (!result.ok) {
      expect(result.message).toMatch(message);
      expect(result.message).not.toContain("raw server text");
    }
  });

  it("updateNickname PUTs only the nickname and returns the member", async () => {
    const { updateNickname } = await import("@/lib/supabase/groups");
    const member = { id: "m1", nickname: "Sammy" };
    const fetchMock = stubFetch(200, { member });
    expect(await updateNickname(ID, " Sammy ")).toEqual({ ok: true, member });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/groups/${ID}/members/me`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ nickname: "Sammy" });
  });

  it("leaveGroup DELETEs and needs { left: true }", async () => {
    const { leaveGroup } = await import("@/lib/supabase/groups");
    const fetchMock = stubFetch(200, { left: true });
    expect(await leaveGroup(ID)).toEqual({ ok: true });
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBe("DELETE");
    stubFetch(200, {});
    expect(await leaveGroup(ID)).toMatchObject({ ok: false, status: 0 });
    stubFetch(404, {});
    expect(await leaveGroup(ID)).toMatchObject({ ok: false, status: 404, message: expect.stringMatching(/not in this group/) });
  });

  it("never throws when offline", async () => {
    const { leaveGroup, renameGroup, updateNickname } = await import("@/lib/supabase/groups");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    for (const r of [await leaveGroup(ID), await renameGroup(ID, "x"), await updateNickname(ID, "x")]) {
      expect(r).toMatchObject({ ok: false, status: 0, message: expect.stringMatching(/connection/) });
    }
  });
});
