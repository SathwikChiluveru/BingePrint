import { NextRequest } from "next/server";
import { toGroupSummary } from "@/lib/share/safety";
import { overTheWire, statsFrom, timedCsv } from "./csv";

export const GROUP_ID = "3f0c8a52-6b1e-4c7a-9d2e-1a2b3c4d5e6f";
export const OTHER_GROUP_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
export const USER = { id: "11111111-2222-4333-8444-555555555555", email: "tester@example.test" };
export const CLIENT_IP = "203.0.113.7";
export const INVITE_CODE = "k7mq4xhr2p";

export function req(
  path: string,
  { method = "GET", body, headers = {} }: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { "x-real-ip": CLIENT_IP, ...headers },
  };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    init.headers["content-type"] = "application/json";
  }
  return new NextRequest(new URL(path, "http://localhost:3000"), init);
}

export function params<T extends Record<string, string>>(p: T) {
  return { params: Promise.resolve(p) };
}

/** A full client-side WrappedStats summary, as the browser would POST it. */
export function wirePayload(): Record<string, unknown> {
  return overTheWire(toGroupSummary(statsFrom(timedCsv()))) as Record<string, unknown>;
}

/** Same, but with the full allBingeSessions list still attached (older clients). */
export function wirePayloadWithSessions(): Record<string, unknown> {
  return overTheWire(statsFrom(timedCsv())) as Record<string, unknown>;
}
