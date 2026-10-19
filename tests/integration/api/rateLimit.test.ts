// Routes with the REAL limiter (src/lib/rate-limit.ts): DB-backed via rate_limit_hit, falling back to
// memory when the RPC is missing. Only the Supabase client is faked.
import { describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeOptions } from "../fixtures/fakeSupabase";
import { GROUP_ID, INVITE_CODE, USER, params, req, wirePayload } from "../fixtures/requests";

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof import("../fixtures/fakeSupabase").createFakeSupabase>,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => h.fake.client) }));

import { POST as join } from "@/app/api/groups/[groupId]/members/route";
import { GET as lookup } from "@/app/api/groups/lookup/route";

function setup(opts: FakeOptions) {
  h.fake = createFakeSupabase(opts);
  return h.fake;
}

const body = () => ({ nickname: "Sam", wrappedData: wirePayload(), inviteCode: INVITE_CODE });
const joinFrom = (ip: string) =>
  join(req(`/api/groups/${GROUP_ID}/members`, { method: "POST", body: body(), headers: { "x-real-ip": ip } }), params({ groupId: GROUP_ID }));

describe("rate limits through the real limiter", () => {
  it("429 when rate_limit_hit says no, and the bucket key is hashed (no raw IP or user id)", async () => {
    const ip = "192.0.2.10";
    const fake = setup({ user: USER, rpc: (fn) => (fn === "rate_limit_hit" ? { data: false, error: null } : undefined) });
    const res = await joinFrom(ip);
    expect(res.status).toBe(429);
    const hits = fake.rpcCalls.filter((c) => c.fn === "rate_limit_hit");
    expect(hits).toHaveLength(1);
    expect(hits[0].args.p_key).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(fake.rpcCalls)).not.toContain(ip);
    expect(fake.rpcCalls.some((c) => c.fn === "join_group")).toBe(false);
  });

  it("falls back to memory when the RPC is missing: 6th join from one IP in a minute is 429", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const ip = "192.0.2.20";
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      setup({
        user: { id: `user-${i}` },
        rpc: (fn) =>
          fn === "rate_limit_hit"
            ? { data: null, error: { code: "PGRST202", message: "not found" } }
            : { data: [{ id: `m${i}` }], error: null },
      });
      statuses.push((await joinFrom(ip)).status);
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });

  it("an erroring limiter fails open (memory) instead of taking the API down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setup({
      user: null,
      rpc: (fn) =>
        fn === "rate_limit_hit"
          ? { data: null, error: { code: "57014", message: "timeout" } }
          : { data: [{ id: GROUP_ID, name: "Couch Club", owner_teaser: null }], error: null },
    });
    const res = await lookup(req(`/api/groups/lookup?code=${INVITE_CODE}`, { headers: { "x-real-ip": "192.0.2.30" } }));
    expect(res.status).toBe(200);
  });
});
