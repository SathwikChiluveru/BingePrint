// PATCH /api/groups/[groupId] (owner rename) with a fake Supabase client and a controllable limiter.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeOptions } from "../fixtures/fakeSupabase";
import { GROUP_ID, USER, params, req } from "../fixtures/requests";

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof import("../fixtures/fakeSupabase").createFakeSupabase>,
  limited: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => h.fake.client) }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async (_supabase: unknown, key: string) => ({
    success: !h.limited.some((p) => key.startsWith(p)),
  })),
}));

import { PATCH } from "@/app/api/groups/[groupId]/route";

function setup(opts: FakeOptions) {
  h.fake = createFakeSupabase(opts);
  return h.fake;
}

beforeEach(() => {
  h.limited = [];
});

const rename = (body: unknown = { name: "Sofa Society" }, groupId = GROUP_ID) =>
  PATCH(req(`/api/groups/${groupId}`, { method: "PATCH", body }), params({ groupId }));

describe("PATCH /api/groups/[groupId] (rename)", () => {
  it("401 when signed out, before any query", async () => {
    const fake = setup({ user: null });
    expect((await rename()).status).toBe(401);
    expect(fake.calls).toHaveLength(0);
  });

  it("404 for a non-UUID id before any client is made", async () => {
    const fake = setup({ user: USER });
    expect((await rename(undefined, "nope")).status).toBe(404);
    expect(fake.client.auth.getUser).not.toHaveBeenCalled();
  });

  it("renames as the owner with a trimmed name, filtered by id and owner, and answers { id, name }", async () => {
    const fake = setup({
      user: USER,
      query: (c) => ({ data: { id: GROUP_ID, name: (c.payload as { name: string }).name }, error: null }),
    });
    const res = await rename({ name: "  Sofa Society  " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: GROUP_ID, name: "Sofa Society" });
    const upd = fake.calls[0];
    expect(upd).toMatchObject({ table: "groups", op: "update", payload: { name: "Sofa Society" } });
    expect(upd.filters).toEqual([
      ["id", GROUP_ID],
      ["owner_id", USER.id],
    ]);
    expect(Object.keys(upd.payload as object)).toEqual(["name"]);
  });

  it("ignores extra fields: only name is ever written", async () => {
    const fake = setup({ user: USER, query: () => ({ data: { id: GROUP_ID, name: "X" }, error: null }) });
    await rename({ name: "X", owner_id: "someone-else", invite_code: "aaaaaaaaaa", owner_teaser: {} });
    expect(fake.calls[0].payload).toEqual({ name: "X" });
  });

  it("422 on a blank or over-60 name, before any query", async () => {
    const fake = setup({ user: USER });
    expect((await rename({ name: "   " })).status).toBe(422);
    expect((await rename({ name: "n".repeat(61) })).status).toBe(422);
    expect((await rename({})).status).toBe(422);
    expect(fake.calls).toHaveLength(0);
  });

  it("403 when the caller can see the group but doesn't own it", async () => {
    setup({
      user: USER,
      query: (c) =>
        c.op === "update" ? { data: null, error: null } : { data: { id: GROUP_ID, owner_id: "other" }, error: null },
    });
    expect((await rename()).status).toBe(403);
  });

  it("404 when the caller can't see the group", async () => {
    setup({ user: USER, query: () => ({ data: null, error: null }) });
    expect((await rename()).status).toBe(404);
  });

  it("500 when the owner's update is blocked (migration 006 not applied)", async () => {
    setup({
      user: USER,
      query: (c) =>
        c.op === "update"
          ? { data: null, error: { code: "42501", message: "permission denied" } }
          : { data: { id: GROUP_ID, owner_id: USER.id }, error: null },
    });
    expect((await rename()).status).toBe(500);
  });

  it("500 on any other update error, without a follow-up read", async () => {
    const fake = setup({ user: USER, query: () => ({ data: null, error: { code: "XX000", message: "boom" } }) });
    expect((await rename()).status).toBe(500);
    expect(fake.calls).toHaveLength(1);
  });

  it("400 on malformed JSON", async () => {
    setup({ user: USER });
    expect((await rename("{nope")).status).toBe(400);
  });

  it("429 per IP before auth, and per user after", async () => {
    let fake = setup({ user: USER });
    h.limited = ["rename-ip:"];
    expect((await rename()).status).toBe(429);
    expect(fake.client.auth.getUser).not.toHaveBeenCalled();

    fake = setup({ user: USER });
    h.limited = ["rename-user:"];
    expect((await rename()).status).toBe(429);
    expect(fake.calls).toHaveLength(0);
  });
});
