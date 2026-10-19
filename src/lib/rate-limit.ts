import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

export interface MemoryLimiter {
  hit(key: string, limit: number, windowMs: number): RateLimitResult;
}

// Expired entries are swept once the map grows past this, so a flood of one-off keys can't leak memory
const MEMORY_SWEEP_AT = 10_000;

/**
 * Pure in-memory fixed-window limiter. Per process only: on serverless hosting each warm instance
 * has its own counts, so it is the fallback, not the real limit. `now` is injectable for tests.
 */
export function createMemoryLimiter(now: () => number = Date.now): MemoryLimiter {
  const map = new Map<string, { count: number; resetAt: number }>();

  return {
    hit(key, limit, windowMs) {
      const t = now();
      if (map.size >= MEMORY_SWEEP_AT) {
        for (const [k, v] of map) if (t > v.resetAt) map.delete(k);
      }

      const entry = map.get(key);
      if (!entry || t > entry.resetAt) {
        map.set(key, { count: 1, resetAt: t + windowMs });
        return { success: true, remaining: Math.max(limit - 1, 0) };
      }
      if (entry.count >= limit) {
        return { success: false, remaining: 0 };
      }
      entry.count++;
      return { success: true, remaining: limit - entry.count };
    },
  };
}

const memory = createMemoryLimiter();
let warnedMissingRpc = false;

/**
 * Opaque bucket key: SHA-256 of salt + key, so the database never sees a raw IP or user id.
 * Uses the same salt as the invite-preview key (migration 003) when it is set.
 */
export function hashRateLimitKey(key: string): string {
  const salt = process.env.INVITE_PREVIEW_SALT ?? process.env.RATE_LIMIT_SALT ?? "autoplayed-rate-limit";
  return createHash("sha256").update(`${salt}:${key}`).digest("hex");
}

/**
 * Durable rate limit shared by every server instance: `rate_limit_hit` (migration 005) bumps a
 * fixed-window counter in Postgres. Call with the request's own Supabase client.
 *
 * Fails open to the in-memory limiter when the function is missing (PGRST202, before 005 is
 * applied) or the call errors, so a database hiccup never takes the API down. Errors are logged.
 */
export async function rateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowMs: number
): Promise<{ success: boolean }> {
  const windowSeconds = Math.max(1, Math.round(windowMs / 1000));
  try {
    const { data, error } = await supabase.rpc("rate_limit_hit", {
      p_key: hashRateLimitKey(key),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (!error && typeof data === "boolean") return { success: data };

    if (error?.code === "PGRST202") {
      if (!warnedMissingRpc) {
        warnedMissingRpc = true;
        console.warn("[rate-limit] rate_limit_hit not found (apply migration 005); using in-memory limits");
      }
    } else {
      console.error("[rate-limit] rate_limit_hit failed; using in-memory limits", error ?? { data });
    }
  } catch (err) {
    console.error("[rate-limit] rate_limit_hit threw; using in-memory limits", err);
  }
  return { success: memory.hit(key, limit, windowMs).success };
}
