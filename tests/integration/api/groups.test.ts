// GET/POST /api/groups with a fake Supabase client and a controllable rate limiter.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeOptions } from "../fixtures/fakeSupabase";
import { GROUP_ID, INVITE_CODE, USER, req, wirePayload, wirePayloadWithSessions } from "../fixtures/requests";

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

import { GET, POST } from "@/app/api/groups/route";
import { rateLimit } from "@/lib/rate-limit";

function setup(opts: FakeOptions) {
  h.fake = createFakeSupabase(opts);
  return h.fake;
}

const GROUP_ROW = {
  id: GROUP_ID,
  name: "Couch Club",
  owner_id: USER.id,
  invite_code: INVITE_CODE,
  created_at: "2024-03-20T00:00:00.000Z",
  share_teaser: true,
};

beforeEach(() => {
  h.limited = [];
  vi.mocked(rateLimit).mockClear();
});

describe("GET /api/groups (my groups)", () => {
  it("401 when signed out, before any query", async () => {
    const fake = setup({ user: null });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fake.calls).toHaveLength(0);
  });

  it("maps rows to summaries without leaking wrapped_data", async () => {
    const fake = setup({
      user: USER,
      query: () => ({
        data: [
          { ...GROUP_ROW, members: [{ user_id: USER.id }, { user_id: "someone-else" }] },
          { ...GROUP_ROW, id: "g2", owner_id: "other", members: [{ user_id: "x" }] },
        ],
        error: null,
      }),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.groups).toEqual([
      { id: GROUP_ID, name: "Couch Club", invite_code: INVITE_CODE, memberCount: 2, ownedByMe: true, isMember: true },
      { id: "g2", name: "Couch Club", invite_code: INVITE_CODE, memberCount: 1, ownedByMe: false, isMember: false },
    ]);
    expect(fake.calls[0].columns).not.toMatch(/wrapped_data/);
    expect(fake.calls[0].limit).toBe(50);
  });

  it("500 on a query error", async () => {
    setup({ user: USER, query: () => ({ data: null, error: { message: "boom" } }) });
    expect((await GET()).status).toBe(500);
  });

  it("429 when rate limited", async () => {
    setup({ user: USER });
    h.limited = ["my-groups:"];
    expect((await GET()).status).toBe(429);
  });
});

describe("POST /api/groups (create)", () => {
  it("401 when signed out, before any query", async () => {
    const fake = setup({ user: null });
    const res = await POST(req("/api/groups", { method: "POST", body: { name: "Couch Club" } }));
    expect(res.status).toBe(401);
    expect(fake.calls).toHaveLength(0);
  });

  it("creates a group alone when no stats come along", async () => {
    const fake = setup({ user: USER, query: (c) => (c.table === "groups" ? { data: GROUP_ROW, error: null } : undefined) });
    const res = await POST(req("/api/groups", { method: "POST", body: { name: "  Couch Club  " } }));
    expect(res.status).toBe(201);
    expect((await res.json()).members).toEqual([]);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].payload).toEqual({ name: "Couch Club", owner_id: USER.id, share_teaser: false, owner_teaser: null });
  });

  it("inserts the owner as the first member with a stripped summary", async () => {
    const memberRow = { id: "m1", group_id: GROUP_ID, user_id: USER.id, nickname: "Sam" };
    const fake = setup({
      user: USER,
      query: (c) =>
        c.table === "groups" ? { data: GROUP_ROW, error: null } : { data: memberRow, error: null },
    });
    const res = await POST(
      req("/api/groups", {
        method: "POST",
        body: { name: "Couch Club", nickname: "Sam", wrapped_data: wirePayloadWithSessions(), share_teaser: true },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.members).toEqual([memberRow]);
    expect(body.warning).toBeUndefined();

    const [groupInsert, memberInsert] = fake.calls;
    expect(groupInsert).toMatchObject({ table: "groups", op: "insert" });
    expect(groupInsert.payload).toMatchObject({ owner_id: USER.id, share_teaser: true });
    expect((groupInsert.payload as { owner_teaser: unknown }).owner_teaser).toMatchObject({
      statLabel: "of Netflix watched",
    });

    expect(memberInsert).toMatchObject({ table: "members", op: "insert", terminal: "single" });
    const p = memberInsert.payload as { group_id: string; user_id: string; nickname: string; wrapped_data: Record<string, unknown> };
    expect(p.group_id).toBe(GROUP_ID);
    expect(p.user_id).toBe(USER.id);
    expect(p.nickname).toBe("Sam");
    expect(p.wrapped_data.allBingeSessions).toEqual([]);
    expect((p.wrapped_data.longestBinge as { titles: unknown[] }).titles).toEqual([]);
  });

  it("ignores share_teaser without stats", async () => {
    const fake = setup({ user: USER, query: () => ({ data: GROUP_ROW, error: null }) });
    await POST(req("/api/groups", { method: "POST", body: { name: "Couch Club", share_teaser: true } }));
    expect(fake.calls[0].payload).toMatchObject({ share_teaser: false, owner_teaser: null });
  });

  it("rolls the group back when the member insert fails (no 201-with-warning)", async () => {
    const fake = setup({
      user: USER,
      query: (c) => {
        if (c.table === "groups" && c.op === "insert") return { data: GROUP_ROW, error: null };
        if (c.table === "members") return { data: null, error: { code: "42501", message: "rls" } };
        return undefined;
      },
    });
    const res = await POST(req("/api/groups", { method: "POST", body: { name: "Couch Club", wrapped_data: wirePayload() } }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.warning).toBeUndefined();
    expect(body.id).toBeUndefined();
    const del = fake.calls.find((c) => c.table === "groups" && c.op === "delete");
    expect(del?.filters).toEqual([["id", GROUP_ID]]);
  });

  it("500 when the group insert fails, with no member insert", async () => {
    const fake = setup({ user: USER, query: () => ({ data: null, error: { message: "nope" } }) });
    const res = await POST(req("/api/groups", { method: "POST", body: { name: "Couch Club", wrapped_data: wirePayload() } }));
    expect(res.status).toBe(500);
    expect(fake.calls.filter((c) => c.table === "members")).toHaveLength(0);
  });

  it("422 on invalid wrapped_data, before any insert", async () => {
    const fake = setup({ user: USER });
    const res = await POST(
      req("/api/groups", { method: "POST", body: { name: "Couch Club", wrapped_data: { ...wirePayload(), personality: "Hacker" } } })
    );
    expect(res.status).toBe(422);
    expect(fake.calls).toHaveLength(0);
  });

  it("422 on a missing or too-long name", async () => {
    setup({ user: USER });
    expect((await POST(req("/api/groups", { method: "POST", body: { name: "   " } }))).status).toBe(422);
    expect((await POST(req("/api/groups", { method: "POST", body: { name: "x".repeat(61) } }))).status).toBe(422);
  });

  it("400 on malformed JSON", async () => {
    setup({ user: USER });
    expect((await POST(req("/api/groups", { method: "POST", body: "{not json" }))).status).toBe(400);
  });

  it("413 on a body over the request cap", async () => {
    const fake = setup({ user: USER });
    const big = JSON.stringify({ name: "Couch Club", pad: "x".repeat(1_000_001) });
    const res = await POST(req("/api/groups", { method: "POST", body: big }));
    expect(res.status).toBe(413);
    expect(fake.calls).toHaveLength(0);
  });

  it("429 when the per-user or per-IP create limit is hit", async () => {
    setup({ user: USER });
    h.limited = ["create:"];
    expect((await POST(req("/api/groups", { method: "POST", body: { name: "A" } }))).status).toBe(429);
    h.limited = ["create-ip:"];
    expect((await POST(req("/api/groups", { method: "POST", body: { name: "A" } }))).status).toBe(429);
  });
});
