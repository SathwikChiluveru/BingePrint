import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMemoryLimiter, hashRateLimitKey, rateLimit } from "@/lib/rate-limit";

describe("createMemoryLimiter", () => {
  afterEach(() => vi.useRealTimers());

  it("allows up to the limit, then blocks", () => {
    const limiter = createMemoryLimiter();
    expect(limiter.hit("ip", 3, 1000)).toEqual({ success: true, remaining: 2 });
    expect(limiter.hit("ip", 3, 1000)).toEqual({ success: true, remaining: 1 });
    expect(limiter.hit("ip", 3, 1000)).toEqual({ success: true, remaining: 0 });
    expect(limiter.hit("ip", 3, 1000)).toEqual({ success: false, remaining: 0 });
    expect(limiter.hit("ip", 3, 1000)).toEqual({ success: false, remaining: 0 });
  });

  it("keeps keys independent", () => {
    const limiter = createMemoryLimiter();
    limiter.hit("a", 1, 1000);
    expect(limiter.hit("a", 1, 1000).success).toBe(false);
    expect(limiter.hit("b", 1, 1000).success).toBe(true);
  });

  it("resets after the window (fake timers, default clock)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const limiter = createMemoryLimiter();
    limiter.hit("ip", 1, 60_000);
    expect(limiter.hit("ip", 1, 60_000).success).toBe(false);
    vi.advanceTimersByTime(59_999);
    expect(limiter.hit("ip", 1, 60_000).success).toBe(false);
    vi.advanceTimersByTime(2);
    expect(limiter.hit("ip", 1, 60_000)).toEqual({ success: true, remaining: 0 });
    expect(limiter.hit("ip", 1, 60_000).success).toBe(false);
  });

  it("uses an injected clock", () => {
    let t = 0;
    const limiter = createMemoryLimiter(() => t);
    limiter.hit("k", 1, 100);
    expect(limiter.hit("k", 1, 100).success).toBe(false);
    t = 101;
    expect(limiter.hit("k", 1, 100).success).toBe(true);
  });

  it("never reports negative remaining for a zero limit", () => {
    const limiter = createMemoryLimiter();
    expect(limiter.hit("k", 0, 1000).remaining).toBe(0);
  });

  it("sweeps expired keys without losing live ones", () => {
    let t = 0;
    const limiter = createMemoryLimiter(() => t);
    for (let i = 0; i < 10_000; i++) limiter.hit(`old${i}`, 1, 10);
    t = 5;
    limiter.hit("live", 1, 1000);
    t = 20;
    // Triggers a sweep; "live" must still be counted
    expect(limiter.hit("live", 1, 1000).success).toBe(false);
    expect(limiter.hit("old1", 1, 10).success).toBe(true);
  });
});

describe("hashRateLimitKey", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is a stable sha-256 hex digest that hides the key", () => {
    const h = hashRateLimitKey("1.2.3.4");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashRateLimitKey("1.2.3.4"));
    expect(h).not.toBe(hashRateLimitKey("1.2.3.5"));
  });

  it("changes with the salt", () => {
    vi.stubEnv("INVITE_PREVIEW_SALT", "");
    vi.stubEnv("RATE_LIMIT_SALT", "");
    const a = hashRateLimitKey("k");
    vi.stubEnv("INVITE_PREVIEW_SALT", "pepper");
    expect(hashRateLimitKey("k")).not.toBe(a);
  });
});

describe("rateLimit", () => {
  const client = (rpc: (...args: unknown[]) => unknown) => ({ rpc: vi.fn(rpc) }) as unknown as SupabaseClient;

  it("uses the database verdict and sends a hashed key", async () => {
    const supabase = client(async () => ({ data: false, error: null }));
    await expect(rateLimit(supabase, "user-1", 5, 60_000)).resolves.toEqual({ success: false });
    expect(supabase.rpc).toHaveBeenCalledWith("rate_limit_hit", {
      p_key: hashRateLimitKey("user-1"),
      p_limit: 5,
      p_window_seconds: 60,
    });
  });

  it("rounds the window to at least one second", async () => {
    const supabase = client(async () => ({ data: true, error: null }));
    await rateLimit(supabase, "k", 1, 10);
    expect(supabase.rpc).toHaveBeenCalledWith("rate_limit_hit", expect.objectContaining({ p_window_seconds: 1 }));
  });

  it("falls back to the in-memory limiter when the RPC is missing, errors or throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const missing = client(async () => ({ data: null, error: { code: "PGRST202", message: "not found" } }));
    const key = `fallback-${Math.random()}`;
    await expect(rateLimit(missing, key, 2, 60_000)).resolves.toEqual({ success: true });
    await expect(rateLimit(missing, key, 2, 60_000)).resolves.toEqual({ success: true });
    await expect(rateLimit(missing, key, 2, 60_000)).resolves.toEqual({ success: false });
    expect(warn).toHaveBeenCalled();

    const failing = client(async () => ({ data: null, error: { code: "500", message: "boom" } }));
    await expect(rateLimit(failing, `${key}-b`, 1, 60_000)).resolves.toEqual({ success: true });
    const throwing = client(async () => {
      throw new Error("network");
    });
    await expect(rateLimit(throwing, `${key}-b`, 1, 60_000)).resolves.toEqual({ success: false });
    expect(error).toHaveBeenCalledTimes(2);
  });
});
