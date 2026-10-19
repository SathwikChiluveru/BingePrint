// GET /auth/callback: exchanges the code, then redirects only to safe same-origin paths.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  exchange: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { exchangeCodeForSession: h.exchange } })),
}));

import { GET } from "@/app/auth/callback/route";

const ORIGIN = "http://localhost:3000";

function callback(query: Record<string, string>) {
  const url = new URL("/auth/callback", ORIGIN);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return GET(new NextRequest(url));
}

function location(res: Response) {
  return res.headers.get("location") ?? "";
}

beforeEach(() => {
  h.exchange = vi.fn(async () => ({ error: null }));
});

describe("auth callback", () => {
  it.each([
    "/groups?join=k7mq4xhr2p",
    "/wrapped/abc12345?autoshare=1",
    "/groups/3f0c8a52-6b1e-4c7a-9d2e-1a2b3c4d5e6f",
  ])("redirects to the safe path %s after a good exchange", async (next) => {
    const res = await callback({ code: "c0de", next });
    expect(res.status).toBe(307);
    expect(location(res)).toBe(`${ORIGIN}${next}`);
    expect(h.exchange).toHaveBeenCalledWith("c0de");
  });

  it("accepts the legacy redirectTo param", async () => {
    const res = await callback({ code: "c0de", redirectTo: "/groups" });
    expect(location(res)).toBe(`${ORIGIN}/groups`);
  });

  it.each([
    "https://evil.example/steal",
    "//evil.example",
    "/\\evil.example",
    "/..//evil.example",
    "javascript:alert(1)",
    "/auth/login",
    "/auth/callback?code=x",
    "/ok\nSet-Cookie:x",
    "groups",
  ])("falls back to /upload for unsafe next %j", async (next) => {
    const res = await callback({ code: "c0de", next });
    const loc = location(res);
    expect(loc).toBe(`${ORIGIN}/upload`);
    expect(new URL(loc).origin).toBe(ORIGIN);
  });

  it("falls back to /upload when next is missing", async () => {
    expect(location(await callback({ code: "c0de" }))).toBe(`${ORIGIN}/upload`);
  });

  it("failed exchange goes back to login, keeping a safe next", async () => {
    h.exchange = vi.fn(async () => ({ error: { message: "expired" } }));
    const loc = new URL(location(await callback({ code: "c0de", next: "/groups?join=k7mq4xhr2p" })));
    expect(loc.origin).toBe(ORIGIN);
    expect(loc.pathname).toBe("/auth/login");
    expect(loc.searchParams.get("error")).toBe("auth_failed");
    expect(loc.searchParams.get("next")).toBe("/groups?join=k7mq4xhr2p");
  });

  it("failed exchange drops an unsafe next", async () => {
    h.exchange = vi.fn(async () => ({ error: { message: "expired" } }));
    const loc = new URL(location(await callback({ code: "c0de", next: "//evil.example" })));
    expect(loc.pathname).toBe("/auth/login");
    expect(loc.searchParams.has("next")).toBe(false);
  });

  it("no code: back to login without calling Supabase", async () => {
    const loc = new URL(location(await callback({ next: "/groups" })));
    expect(loc.pathname).toBe("/auth/login");
    expect(loc.searchParams.get("next")).toBe("/groups");
    expect(h.exchange).not.toHaveBeenCalled();
  });
});
