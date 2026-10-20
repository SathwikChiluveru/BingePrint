import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WrappedStats } from "@/types";

type StoreModule = typeof import("@/lib/store");

const DAY = 24 * 60 * 60 * 1000;

/** Fresh module (and so a fresh store + migration run) per test. */
async function loadStore(): Promise<StoreModule> {
  vi.resetModules();
  return import("@/lib/store");
}

const stats = { personality: "The Night Owl" } as unknown as WrappedStats;

beforeEach(() => {
  localStorage.clear();
  // adoptJoinParam looks the code up in the background; offline unless a test says otherwise
  vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
});

describe("isPendingInviteFresh", () => {
  it("is fresh inside the 7-day TTL and stale at or past it", async () => {
    const { isPendingInviteFresh, PENDING_INVITE_TTL_MS } = await loadStore();
    expect(PENDING_INVITE_TTL_MS).toBe(7 * DAY);
    const now = 1_700_000_000_000;
    expect(isPendingInviteFresh({ code: "abcd1234", savedAt: now - 1000 }, now)).toBe(true);
    expect(isPendingInviteFresh({ code: "abcd1234", savedAt: now - 7 * DAY + 1 }, now)).toBe(true);
    expect(isPendingInviteFresh({ code: "abcd1234", savedAt: now - 7 * DAY }, now)).toBe(false);
    expect(isPendingInviteFresh({ code: "abcd1234", savedAt: now - 8 * DAY }, now)).toBe(false);
  });

  it("rejects null, missing savedAt and malformed codes", async () => {
    const { isPendingInviteFresh } = await loadStore();
    const now = Date.now();
    expect(isPendingInviteFresh(null, now)).toBe(false);
    expect(isPendingInviteFresh({ code: "abcd1234" }, now)).toBe(false);
    expect(isPendingInviteFresh({ code: "ABCD1234", savedAt: now }, now)).toBe(false);
    expect(isPendingInviteFresh({ code: "x", savedAt: now }, now)).toBe(false);
  });
});

describe("setPendingInvite", () => {
  it("stamps savedAt and drops invalid codes", async () => {
    const { useAutoplayedStore } = await loadStore();
    vi.spyOn(Date, "now").mockReturnValue(1234);
    useAutoplayedStore.getState().setPendingInvite({ code: "abcd1234", groupName: "Crew" });
    expect(useAutoplayedStore.getState().pendingInvite).toEqual({ code: "abcd1234", groupName: "Crew", savedAt: 1234 });
    useAutoplayedStore.getState().setPendingInvite({ code: "bad" });
    expect(useAutoplayedStore.getState().pendingInvite).toBeNull();
  });
});

describe("adoptJoinParam", () => {
  it("normalizes and stores a valid ?join= code", async () => {
    const { adoptJoinParam, useAutoplayedStore } = await loadStore();
    expect(adoptJoinParam(" ABCD-1234 ")).toBe("abcd1234");
    expect(useAutoplayedStore.getState().pendingInvite?.code).toBe("abcd1234");
    expect(typeof useAutoplayedStore.getState().pendingInvite?.savedAt).toBe("number");
  });

  it("ignores malformed or missing codes and keeps the existing invite", async () => {
    const { adoptJoinParam, useAutoplayedStore } = await loadStore();
    useAutoplayedStore.getState().setPendingInvite({ code: "abcd1234" });
    expect(adoptJoinParam("nope")).toBeNull();
    expect(adoptJoinParam(null)).toBeNull();
    expect(adoptJoinParam("<script>alert(1)</script>")).toBeNull();
    expect(useAutoplayedStore.getState().pendingInvite?.code).toBe("abcd1234");
  });

  it("keeps the group name and id of a fresh invite for the same code", async () => {
    const { adoptJoinParam, useAutoplayedStore } = await loadStore();
    useAutoplayedStore.getState().setPendingInvite({ code: "abcd1234", groupName: "Crew", groupId: "g1" });
    expect(adoptJoinParam("ABCD1234")).toBe("abcd1234");
    expect(useAutoplayedStore.getState().pendingInvite).toMatchObject({ groupName: "Crew", groupId: "g1" });
  });

  it("replaces a different or stale invite", async () => {
    const { adoptJoinParam, useAutoplayedStore } = await loadStore();
    useAutoplayedStore.getState().setPendingInvite({ code: "abcd1234", groupName: "Crew" });
    adoptJoinParam("zzzz9999");
    expect(useAutoplayedStore.getState().pendingInvite).not.toHaveProperty("groupName");

    useAutoplayedStore.getState().setPendingInvite({ code: "abcd1234", groupName: "Old", savedAt: 0 });
    adoptJoinParam("abcd1234");
    const invite = useAutoplayedStore.getState().pendingInvite!;
    expect(invite.groupName).toBeUndefined();
    expect(invite.savedAt).toBeGreaterThan(0);
  });
});

describe("setMyGroup and myGroupNeedsUpdate", () => {
  it("fills sessionId from the current reel when missing", async () => {
    const { useAutoplayedStore } = await loadStore();
    useAutoplayedStore.getState().setWrapped(stats, "sess0001");
    useAutoplayedStore.getState().setMyGroup({ id: "g1", inviteCode: "abcd1234", name: "Crew" });
    expect(useAutoplayedStore.getState().myGroup?.sessionId).toBe("sess0001");
  });

  it("keeps an explicit sessionId and allows clearing", async () => {
    const { useAutoplayedStore } = await loadStore();
    useAutoplayedStore.getState().setWrapped(stats, "sess0001");
    useAutoplayedStore.getState().setMyGroup({ id: "g1", inviteCode: "abcd1234", name: "Crew", sessionId: "other" });
    expect(useAutoplayedStore.getState().myGroup?.sessionId).toBe("other");
    useAutoplayedStore.getState().setMyGroup(null);
    expect(useAutoplayedStore.getState().myGroup).toBeNull();
  });

  it("leaves sessionId undefined when there is no reel", async () => {
    const { useAutoplayedStore } = await loadStore();
    useAutoplayedStore.getState().setMyGroup({ id: "g1", inviteCode: "abcd1234", name: "Crew" });
    expect(useAutoplayedStore.getState().myGroup?.sessionId).toBeUndefined();
  });

  it("needs an update only when the group was saved from a different reel", async () => {
    const { useAutoplayedStore, myGroupNeedsUpdate, isMyGroupStale } = await loadStore();
    expect(myGroupNeedsUpdate()).toBe(false);
    useAutoplayedStore.getState().setWrapped(stats, "reel0001");
    useAutoplayedStore.getState().setMyGroup({ id: "g1", inviteCode: "abcd1234", name: "Crew" });
    expect(myGroupNeedsUpdate()).toBe(false);
    useAutoplayedStore.getState().setWrapped(stats, "reel0002");
    expect(myGroupNeedsUpdate()).toBe(true);
    expect(myGroupNeedsUpdate("reel0001")).toBe(false);
    expect(myGroupNeedsUpdate(null)).toBe(false);
    // A new reel never clears the group
    expect(useAutoplayedStore.getState().myGroup?.id).toBe("g1");
    // Unknown origin is not stale
    expect(isMyGroupStale({ id: "g", inviteCode: "abcd1234", name: "x" }, "reel")).toBe(false);
  });

  it("clearMyGroupIfStale is a no-op and updateMyStatsHref encodes the id", async () => {
    const { clearMyGroupIfStale, updateMyStatsHref } = await loadStore();
    expect(clearMyGroupIfStale("anything")).toBe(false);
    expect(updateMyStatsHref("a/b")).toBe("/groups/a%2Fb?update=1");
  });

  it("clearWrapped resets the reel only", async () => {
    const { useAutoplayedStore } = await loadStore();
    useAutoplayedStore.getState().setWrapped(stats, "reel0001");
    useAutoplayedStore.getState().setMyGroup({ id: "g1", inviteCode: "abcd1234", name: "Crew" });
    useAutoplayedStore.getState().clearWrapped();
    expect(useAutoplayedStore.getState()).toMatchObject({ wrappedStats: null, sessionId: null });
    expect(useAutoplayedStore.getState().myGroup?.id).toBe("g1");
  });
});

describe("persistence and legacy key migration", () => {
  const legacyValue = JSON.stringify({
    state: { wrappedStats: stats, sessionId: "legacy01", pendingInvite: null, myGroup: null },
    version: 0,
  });

  it("persists under autoplayed-session", async () => {
    const { useAutoplayedStore } = await loadStore();
    useAutoplayedStore.getState().setWrapped(stats, "reel0001");
    const saved = JSON.parse(localStorage.getItem("autoplayed-session")!);
    expect(saved.state.sessionId).toBe("reel0001");
  });

  it("copies binge-print-session to autoplayed-session, removes it, and hydrates from it", async () => {
    localStorage.setItem("binge-print-session", legacyValue);
    const { useAutoplayedStore } = await loadStore();
    expect(localStorage.getItem("binge-print-session")).toBeNull();
    expect(JSON.parse(localStorage.getItem("autoplayed-session")!).state.sessionId).toBe("legacy01");
    expect(useAutoplayedStore.getState().sessionId).toBe("legacy01");
  });

  it("never overwrites an existing autoplayed-session, but still removes the legacy key", async () => {
    const current = JSON.stringify({ state: { sessionId: "current1" }, version: 0 });
    localStorage.setItem("autoplayed-session", current);
    localStorage.setItem("binge-print-session", legacyValue);
    const { useAutoplayedStore } = await loadStore();
    expect(localStorage.getItem("binge-print-session")).toBeNull();
    expect(useAutoplayedStore.getState().sessionId).toBe("current1");
  });
});

describe("adoptJoinParam lookup enrichment", () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("fills the group name and id from the public lookup, once per code", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "g1", name: "Crew", preview: true })));
    vi.stubGlobal("fetch", fetchMock);
    const { adoptJoinParam, useAutoplayedStore } = await loadStore();
    adoptJoinParam("abcd1234");
    await flush();
    expect(useAutoplayedStore.getState().pendingInvite).toMatchObject({ code: "abcd1234", groupName: "Crew", groupId: "g1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/groups/lookup?code=abcd1234");
    adoptJoinParam("abcd1234");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("enriches a fresh saved invite that has no name yet", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "g1", name: "Crew" })));
    vi.stubGlobal("fetch", fetchMock);
    const { adoptJoinParam, useAutoplayedStore } = await loadStore();
    useAutoplayedStore.getState().setPendingInvite({ code: "abcd1234" });
    adoptJoinParam("abcd1234");
    await flush();
    expect(useAutoplayedStore.getState().pendingInvite?.groupName).toBe("Crew");
  });

  it("skips the lookup when the saved invite already has a name and id", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { adoptJoinParam, useAutoplayedStore } = await loadStore();
    useAutoplayedStore.getState().setPendingInvite({ code: "abcd1234", groupName: "Crew", groupId: "g1" });
    adoptJoinParam("abcd1234");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the bare code on a failed lookup and never throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    const { adoptJoinParam, useAutoplayedStore } = await loadStore();
    expect(adoptJoinParam("abcd1234")).toBe("abcd1234");
    await flush();
    expect(useAutoplayedStore.getState().pendingInvite).not.toHaveProperty("groupName");
  });

  it("never overwrites a newer invite for a different code", async () => {
    let resolve!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (resolve = r))));
    const { adoptJoinParam, useAutoplayedStore } = await loadStore();
    adoptJoinParam("abcd1234");
    useAutoplayedStore.getState().setPendingInvite({ code: "zzzz9999" });
    resolve(new Response(JSON.stringify({ id: "g1", name: "Crew" })));
    await flush();
    expect(useAutoplayedStore.getState().pendingInvite).toMatchObject({ code: "zzzz9999" });
    expect(useAutoplayedStore.getState().pendingInvite).not.toHaveProperty("groupName");
  });
});

describe("forgetMyGroup", () => {
  it("clears the stored group (and its pending invite) only when it is that group", async () => {
    const { forgetMyGroup, useAutoplayedStore } = await loadStore();
    const s = useAutoplayedStore.getState();
    s.setMyGroup({ id: "g1", inviteCode: "abcd1234", name: "Crew" });
    s.setPendingInvite({ code: "abcd1234", groupId: "g1" });
    expect(forgetMyGroup("g2")).toBe(false);
    expect(useAutoplayedStore.getState().myGroup?.id).toBe("g1");
    expect(forgetMyGroup("g1")).toBe(true);
    expect(useAutoplayedStore.getState().myGroup).toBeNull();
    expect(useAutoplayedStore.getState().pendingInvite).toBeNull();
  });
});
