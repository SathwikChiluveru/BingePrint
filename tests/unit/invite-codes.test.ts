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
