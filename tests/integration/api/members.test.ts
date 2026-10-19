// POST /api/groups/[groupId]/members (join) and PUT .../members/me (update my stats).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeOptions } from "../fixtures/fakeSupabase";
import { GROUP_ID, INVITE_CODE, USER, params, req, wirePayload, wirePayloadWithSessions } from "../fixtures/requests";

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof import("../fixtures/fakeSupabase").createFakeSupabase>,
  limited: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => h.fake.client) }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async (_supabase: unknown, key: string) => {
    const blocked = h.limited.some((p) => key.startsWith(p));
    return { success: !blocked };
  }),
}));

import { POST as join } from "@/app/api/groups/[groupId]/members/route";
import { PUT as update } from "@/app/api/groups/[groupId]/members/me/route";

function setup(opts: FakeOptions) {
  h.fake = createFakeSupabase(opts);
  return h.fake;
}

beforeEach(() => {
  h.limited = [];
});

const joinBody = () => ({ nickname: "Sam", wrappedData: wirePayload(), inviteCode: INVITE_CODE.toUpperCase() });
const joinReq = (body: unknown = joinBody(), groupId = GROUP_ID) =>
  join(req(`/api/groups/${groupId}/members`, { method: "POST", body }), params({ groupId }));

describe("POST /api/groups/[groupId]/members (join)", () => {
  it("401 when signed out, without calling join_group", async () => {
    const fake = setup({ user: null });
    const res = await joinReq();
    expect(res.status).toBe(401);
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("404 for a non-UUID group id before any client is made", async () => {
    const fake = setup({ user: USER });
    expect((await joinReq(joinBody(), "not-a-uuid")).status).toBe(404);
    expect(fake.client.auth.getUser).not.toHaveBeenCalled();
  });

  it("joins through join_group with a lowercased code and a stripped summary", async () => {
    const row = { id: "m1", group_id: GROUP_ID, user_id: USER.id, nickname: "Sam" };
    const fake = setup({ user: USER, rpc: () => ({ data: [row], error: null }) });
    const res = await joinReq({ ...joinBody(), wrappedData: wirePayloadWithSessions() });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(row);
    expect(fake.rpcCalls).toHaveLength(1);
    const { fn, args } = fake.rpcCalls[0];
    expect(fn).toBe("join_group");
    expect(args.p_group_id).toBe(GROUP_ID);
    expect(args.p_invite_code).toBe(INVITE_CODE);
    expect(args.p_nickname).toBe("Sam");
    const wrapped = args.p_wrapped_data as Record<string, unknown>;
    expect(wrapped.allBingeSessions).toEqual([]);
    expect((wrapped.longestBinge as { titles: unknown[] }).titles).toEqual([]);
  });

  it("passes a null code when none is sent (owner joining their own group)", async () => {
    const fake = setup({ user: USER, rpc: () => ({ data: { id: "m1" }, error: null }) });
    const { inviteCode: _drop, ...body } = joinBody();
    void _drop;
    expect((await joinReq(body)).status).toBe(201);
    expect(fake.rpcCalls[0].args.p_invite_code).toBeNull();
  });

  it.each([
    ["PT404", "group_not_found", 404],
    ["23505", "duplicate key", 409],
    ["PT422", "invalid", 422],
    ["XX000", "anything else", 500],
  ])("maps RPC error %s to %i", async (code, message, status) => {
    setup({ user: USER, rpc: () => ({ data: null, error: { code, message } }) });
    expect((await joinReq()).status).toBe(status);
  });

  it("maps a group_not_found message without a code to 404", async () => {
    setup({ user: USER, rpc: () => ({ data: null, error: { message: "ERROR: group_not_found" } }) });
    expect((await joinReq()).status).toBe(404);
  });

  // PT429 is the app's database rate-limit errcode; a rate-limited join must surface as 429,
  // matching lookup.ts, not as a generic 500.
  it("maps RPC error PT429 (database rate limit) to 429", async () => {
    setup({ user: USER, rpc: () => ({ data: null, error: { code: "PT429", message: "rate_limited" } }) });
    expect((await joinReq()).status).toBe(429);
  });

  it("500 when join_group returns no row", async () => {
    setup({ user: USER, rpc: () => ({ data: [], error: null }) });
    expect((await joinReq()).status).toBe(500);
  });

  it("422 on invalid wrappedData, nickname or code, before the RPC", async () => {
    const fake = setup({ user: USER });
    expect((await joinReq({ ...joinBody(), wrappedData: { totalHours: "lots" } })).status).toBe(422);
    expect((await joinReq({ ...joinBody(), nickname: "" })).status).toBe(422);
    expect((await joinReq({ ...joinBody(), nickname: "n".repeat(31) })).status).toBe(422);
    expect((await joinReq({ ...joinBody(), inviteCode: "bad code!" })).status).toBe(422);
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("413 when content-length declares more than the cap", async () => {
    const fake = setup({ user: USER });
    const res = await join(
      req(`/api/groups/${GROUP_ID}/members`, { method: "POST", body: joinBody(), headers: { "content-length": "2000000" } }),
      params({ groupId: GROUP_ID })
    );
    expect(res.status).toBe(413);
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("413 when the body itself is over the cap", async () => {
    const fake = setup({ user: USER });
    const res = await joinReq(JSON.stringify({ ...joinBody(), pad: "x".repeat(1_000_001) }));
    expect(res.status).toBe(413);
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("429 per IP before auth, and per user after", async () => {
    let fake = setup({ user: USER });
    h.limited = ["join:"];
    expect((await joinReq()).status).toBe(429);
    expect(fake.client.auth.getUser).not.toHaveBeenCalled();

    fake = setup({ user: USER });
    h.limited = ["join-user:"];
    expect((await joinReq()).status).toBe(429);
    expect(fake.rpcCalls).toHaveLength(0);
  });
});

const CURRENT = {
  id: "m1",
  group_id: GROUP_ID,
  user_id: USER.id,
  nickname: "Sam",
  wrapped_data: { old: true },
};
const updateReq = (body: unknown = { wrappedData: wirePayload() }) =>
  update(req(`/api/groups/${GROUP_ID}/members/me`, { method: "PUT", body }), params({ groupId: GROUP_ID }));

describe("PUT /api/groups/[groupId]/members/me (update my stats)", () => {
  it("401 when signed out", async () => {
    const fake = setup({ user: null });
    expect((await updateReq()).status).toBe(401);
    expect(fake.calls).toHaveLength(0);
  });

  it("422 on invalid wrappedData", async () => {
    const fake = setup({ user: USER });
    expect((await updateReq({ wrappedData: { personality: "x" } })).status).toBe(422);
    expect(fake.calls).toHaveLength(0);
  });

  it("404 when the caller has no row in the group", async () => {
    setup({ user: USER, query: () => ({ data: null, error: null }) });
    expect((await updateReq()).status).toBe(404);
  });

  it("updates the caller's own row with a stripped summary", async () => {
    const fake = setup({
      user: USER,
      query: (c) =>
        c.op === "select" ? { data: CURRENT, error: null } : { data: { ...CURRENT, wrapped_data: c.payload }, error: null },
    });
    const res = await updateReq({ wrappedData: wirePayloadWithSessions() });
    expect(res.status).toBe(200);
    const upd = fake.calls.find((c) => c.op === "update");
    expect(upd?.filters).toEqual([
      ["id", "m1"],
      ["user_id", USER.id],
    ]);
    const wrapped = (upd?.payload as { wrapped_data: Record<string, unknown> }).wrapped_data;
    expect(wrapped.allBingeSessions).toEqual([]);
    expect(Object.keys(upd?.payload as object)).toEqual(["wrapped_data"]);
  });

  it("falls back to delete + rejoin when RLS blocks the update, and restores the old row on failure", async () => {
    let joinCount = 0;
    const fake = setup({
      user: USER,
      query: (c) => {
        if (c.table === "members" && c.op === "select") return { data: CURRENT, error: null };
        if (c.table === "members" && c.op === "update") return { data: null, error: null };
        if (c.table === "groups") return { data: { invite_code: INVITE_CODE }, error: null };
        return { data: null, error: null };
      },
      rpc: () => {
        joinCount++;
        return joinCount === 1 ? { data: null, error: { code: "PT422", message: "bad" } } : { data: [CURRENT], error: null };
      },
    });
    const res = await updateReq();
    expect(res.status).toBe(500);
    expect(fake.calls.some((c) => c.table === "members" && c.op === "delete")).toBe(true);
    expect(fake.rpcCalls).toHaveLength(2);
    expect(fake.rpcCalls[1].args.p_wrapped_data).toEqual({ old: true });
    expect(fake.rpcCalls[1].args.p_invite_code).toBe(INVITE_CODE);
  });

  it("429 when rate limited", async () => {
    setup({ user: USER });
    h.limited = ["update-user:"];
    expect((await updateReq()).status).toBe(429);
    h.limited = ["update-ip:"];
    expect((await updateReq()).status).toBe(429);
  });
});
