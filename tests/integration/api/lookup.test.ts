// GET /api/groups/lookup and GET /api/groups/[groupId]: invite previews for non-members.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeOptions } from "../fixtures/fakeSupabase";
import { CLIENT_IP, GROUP_ID, INVITE_CODE, OTHER_GROUP_ID, USER, params, req } from "../fixtures/requests";

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

import { GET as lookup } from "@/app/api/groups/lookup/route";
import { GET as getGroup } from "@/app/api/groups/[groupId]/route";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

function setup(opts: FakeOptions) {
  h.fake = createFakeSupabase(opts);
  return h.fake;
}

const TEASER = { personality: "The Night Owl", statValue: "120h", statLabel: "of Netflix watched" };
const PREVIEW_ROW = { id: GROUP_ID, name: "Couch Club", owner_teaser: TEASER };

beforeEach(() => {
  h.limited = [];
  vi.mocked(createClient).mockClear();
  vi.mocked(rateLimit).mockClear();
});

describe("GET /api/groups/lookup", () => {
  it.each(["", "short", "has spaces!!", "x".repeat(11), "abc_defghi"])(
    "400 for code %j before any DB call",
    async (code) => {
      const fake = setup({ user: null });
      const res = await lookup(req(`/api/groups/lookup?code=${encodeURIComponent(code)}`));
      expect(res.status).toBe(400);
      // Only the (mocked) limiter ran: no auth read, no query, no RPC
      expect(fake.client.auth.getUser).not.toHaveBeenCalled();
      expect(fake.calls).toHaveLength(0);
      expect(fake.rpcCalls).toHaveLength(0);
    }
  );

  it("works signed out via public_invite_preview with a hashed client key, never the raw IP", async () => {
    const fake = setup({ user: null, rpc: () => ({ data: [PREVIEW_ROW], error: null }) });
    // People retype codes in caps with dashes; the route normalizes them
    const res = await lookup(req(`/api/groups/lookup?code=K7MQ-4XHR-2P`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      id: GROUP_ID,
      name: "Couch Club",
      invite_code: INVITE_CODE,
      owner_teaser: TEASER,
      preview: true,
    });
    expect(fake.rpcCalls).toHaveLength(1);
    const { fn, args } = fake.rpcCalls[0];
    expect(fn).toBe("public_invite_preview");
    expect(args.code).toBe(INVITE_CODE);
    const key = args.client_key as string;
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain(CLIENT_IP);
    expect(JSON.stringify(fake.rpcCalls)).not.toContain(CLIENT_IP);
  });

  it("passes the owner nickname through and drops junk keys, blank or placeholder names", async () => {
    const cases: Array<[unknown, Record<string, unknown>]> = [
      [{ ...TEASER, nickname: "Sam" }, { ...TEASER, nickname: "Sam" }],
      [{ ...TEASER, nickname: "Me" }, TEASER],
      [{ ...TEASER, nickname: "   " }, TEASER],
      [{ ...TEASER, nickname: "n".repeat(31) }, TEASER],
      [{ ...TEASER, nickname: "Sam", ownerId: "leak" }, { ...TEASER, nickname: "Sam" }],
      [{ ...TEASER, personality: "The Genre Surfer" }, { ...TEASER, personality: "The Channel Surfer" }],
    ];
    for (const [stored, shown] of cases) {
      setup({ user: null, rpc: () => ({ data: [{ ...PREVIEW_ROW, owner_teaser: stored }], error: null }) });
      const res = await lookup(req(`/api/groups/lookup?code=${INVITE_CODE}`));
      expect((await res.json()).owner_teaser).toEqual(shown);
    }
  });

  it("drops a teaser whose nickname is not a string", async () => {
    setup({ user: null, rpc: () => ({ data: [{ ...PREVIEW_ROW, owner_teaser: { ...TEASER, nickname: 5 } }], error: null }) });
    const res = await lookup(req(`/api/groups/lookup?code=${INVITE_CODE}`));
    expect((await res.json()).owner_teaser).toBeNull();
  });

  it("gives the same client the same key, and a different client a different one", async () => {
    const fake = setup({ user: null, rpc: () => ({ data: [PREVIEW_ROW], error: null }) });
    await lookup(req(`/api/groups/lookup?code=${INVITE_CODE}`));
    await lookup(req(`/api/groups/lookup?code=${INVITE_CODE}`));
    await lookup(req(`/api/groups/lookup?code=${INVITE_CODE}`, { headers: { "x-real-ip": "198.51.100.9" } }));
    const keys = fake.rpcCalls.map((c) => c.args.client_key);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("uses group_by_invite_code when signed in and hides an opted-out teaser", async () => {
    const fake = setup({
      user: USER,
      rpc: () => ({ data: [{ ...PREVIEW_ROW, share_teaser: false }], error: null }),
    });
    const res = await lookup(req(`/api/groups/lookup?code=${INVITE_CODE}`));
    expect(res.status).toBe(200);
    expect((await res.json()).owner_teaser).toBeNull();
    expect(fake.rpcCalls[0]).toEqual({ fn: "group_by_invite_code", args: { code: INVITE_CODE } });
  });

  it.each([
    [{ data: [], error: null }, 404],
    [{ data: null, error: { code: "PT429", message: "rate_limited" } }, 429],
    [{ data: null, error: { code: "PT401", message: "sign_in_required" } }, 401],
    [{ data: null, error: { code: "PGRST202", message: "function missing" } }, 401],
    [{ data: null, error: { code: "XX000", message: "boom" } }, 500],
  ])("maps signed-out RPC result %j to %i", async (result, status) => {
    setup({ user: null, rpc: () => result });
    expect((await lookup(req(`/api/groups/lookup?code=${INVITE_CODE}`))).status).toBe(status);
  });

  it("429 from the per-IP limiter before the lookup RPC", async () => {
    const fake = setup({ user: null });
    h.limited = ["lookup:"];
    const res = await lookup(req(`/api/groups/lookup?code=${INVITE_CODE}`));
    expect(res.status).toBe(429);
    expect(fake.rpcCalls).toHaveLength(0);
    expect(fake.client.auth.getUser).not.toHaveBeenCalled();
    expect(vi.mocked(rateLimit).mock.calls[0][0]).toBe(fake.client);
    expect(vi.mocked(rateLimit).mock.calls[0][1]).toBe(`lookup:${CLIENT_IP}`);
  });
});

describe("GET /api/groups/[groupId]", () => {
  const get = (path: string, groupId = GROUP_ID) => getGroup(req(path), params({ groupId }));

  it("404 for a non-UUID id", async () => {
    setup({ user: USER });
    expect((await get("/api/groups/abc", "abc")).status).toBe(404);
  });

  it("returns the full group with members to a member", async () => {
    const row = { id: GROUP_ID, name: "Couch Club", members: [{ id: "m1", nickname: "Sam" }] };
    const fake = setup({ user: USER, query: () => ({ data: row, error: null }) });
    const res = await get(`/api/groups/${GROUP_ID}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(row);
    expect(fake.calls[0].filters).toEqual([["id", GROUP_ID]]);
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("signed-in non-member with the code gets a preview without members", async () => {
    const fake = setup({
      user: USER,
      query: () => ({ data: null, error: null }),
      rpc: () => ({ data: [{ ...PREVIEW_ROW, share_teaser: true }], error: null }),
    });
    const res = await get(`/api/groups/${GROUP_ID}?code=${INVITE_CODE}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preview).toBe(true);
    expect(body.members).toEqual([]);
    expect(body.owner_teaser).toEqual(TEASER);
    expect(fake.rpcCalls[0].fn).toBe("group_by_invite_code");
  });

  it("signed-out visitor with the code gets a preview via public_invite_preview", async () => {
    const fake = setup({ user: null, rpc: () => ({ data: [PREVIEW_ROW], error: null }) });
    const res = await get(`/api/groups/${GROUP_ID}?code=${INVITE_CODE}`);
    expect(res.status).toBe(200);
    expect((await res.json()).members).toEqual([]);
    expect(fake.calls).toHaveLength(0);
    expect(fake.rpcCalls[0].fn).toBe("public_invite_preview");
    expect(fake.rpcCalls[0].args.client_key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("signed out without a code: 401", async () => {
    setup({ user: null });
    expect((await get(`/api/groups/${GROUP_ID}`)).status).toBe(401);
  });

  it("signed-in non-member without a code: 404", async () => {
    const fake = setup({ user: USER, query: () => ({ data: null, error: null }) });
    expect((await get(`/api/groups/${GROUP_ID}`)).status).toBe(404);
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("a code for a different group: 404, never that group's preview", async () => {
    setup({ user: null, rpc: () => ({ data: [{ ...PREVIEW_ROW, id: OTHER_GROUP_ID }], error: null }) });
    const res = await get(`/api/groups/${GROUP_ID}?code=${INVITE_CODE}`);
    expect(res.status).toBe(404);
    expect(JSON.stringify(await res.json())).not.toContain("Couch Club");
  });

  it("a failed member query is 500, not 404", async () => {
    setup({ user: USER, query: () => ({ data: null, error: { message: "timeout" } }) });
    expect((await get(`/api/groups/${GROUP_ID}`)).status).toBe(500);
  });

  it("429 from the preview limiter and from the database limiter", async () => {
    setup({ user: null, rpc: () => ({ data: [PREVIEW_ROW], error: null }) });
    h.limited = ["lookup:"];
    expect((await get(`/api/groups/${GROUP_ID}?code=${INVITE_CODE}`)).status).toBe(429);

    h.limited = [];
    setup({ user: null, rpc: () => ({ data: null, error: { code: "PT429", message: "rate_limited" } }) });
    expect((await get(`/api/groups/${GROUP_ID}?code=${INVITE_CODE}`)).status).toBe(429);
  });
});
