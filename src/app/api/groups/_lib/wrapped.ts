import { createHash } from "node:crypto";
import { z } from "zod";
import type { NextRequest } from "next/server";
import type { OwnerTeaser } from "@/lib/supabase/groups";

// Raw request cap. Clients still send full WrappedStats (incl. allBingeSessions, which can run to
// a few hundred KB for long histories), so the cap is generous; what gets stored is the summary.
export const MAX_REQUEST_BYTES = 1_000_000;
// What we store after stripping. A real summary is ~2 KB.
export const MAX_STORED_BYTES = 16_384;

const count = z.number().finite().min(0).max(1e10);
const text = (max: number) => z.string().max(max);
const dateLike = z.union([z.string().max(40), z.number().finite()]);

const ShowStatSchema = z.object({
  title: text(200),
  watchCount: count,
  totalSeconds: count,
  // Set by stats.ts so cards can say "watched 3 times" for a film instead of "3 episodes"
  kind: z.enum(["show", "movie"]).optional(),
});

const PERSONALITIES = [
  "The Binge Lord",
  "The Night Owl",
  "The Weekend Warrior",
  "The Loyalist",
  "The Genre Surfer",
  "The Casual Viewer",
] as const;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * The only wrapped fields a group ever sees. Unknown keys (and allBingeSessions) are dropped by
 * zod's default strip; longestBinge keeps its totals but not its title list.
 */
const WrappedSummarySchema = z.object({
  totalSeconds: count,
  totalHours: count,
  totalDays: count,
  topShows: z.array(ShowStatSchema).max(10).transform((shows) => shows.slice(0, 5)),
  mostLoyalShow: ShowStatSchema,
  longestBinge: z
    .object({
      startTime: dateLike,
      endTime: dateLike,
      totalSeconds: count,
      showCount: count,
      titles: z.array(z.unknown()).optional(),
      titleCount: count.optional(),
    })
    .transform(({ titles, ...rest }) => ({
      ...rest,
      titleCount: rest.titleCount ?? titles?.length,
      titles: [] as string[],
    })),
  nightOwlScore: z.number().finite().min(0).max(100),
  dayHeatmap: z.array(z.object({ day: z.enum(DAYS), hours: count })).max(7),
  // Titles started per weekday: exact even for date-only exports, so groups can compare them
  dayTitleCounts: z.array(z.object({ day: z.enum(DAYS), count })).max(7).optional(),
  personality: z.enum(PERSONALITIES),
  personalityDescription: text(400),
  funComparison: text(400),
  peakHour: z.number().int().min(0).max(23),
  uniqueShowsCount: count,
  totalEpisodesEstimate: count,
  hasTimeData: z.boolean().optional(),
  weeksSpanned: count.optional(),
  // Unique title+day pairs: the fair "titles" count across both export types (timed exports log
  // one row per viewing session, so totalEpisodesEstimate overcounts there)
  distinctTitleDays: count.int().optional(),
});

export type WrappedSummary = z.infer<typeof WrappedSummarySchema> & { allBingeSessions: [] };

export const WrappedDataSchema = WrappedSummarySchema.transform(
  (s): WrappedSummary => ({ ...s, allBingeSessions: [] })
).refine((s) => JSON.stringify(s).length <= MAX_STORED_BYTES, { message: "wrapped_data too large" });

export type ReadJsonResult =
  | { ok: true; body: unknown }
  | { ok: false; status: 400 | 413; error: string };

/** Reads a JSON body, refusing anything over MAX_REQUEST_BYTES before parsing. */
export async function readJson(request: NextRequest): Promise<ReadJsonResult> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_REQUEST_BYTES) return { ok: false, status: 413, error: "Request too large" };
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, status: 400, error: "Invalid body" };
  }
  if (raw.length > MAX_REQUEST_BYTES) return { ok: false, status: 413, error: "Request too large" };
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON" };
  }
}

/**
 * Personality + one headline stat, derived from the validated summary (never from client text).
 * Date-only exports lead with the exact title count; their hours are an estimate, so they trail.
 */
export function buildOwnerTeaser(s: WrappedSummary): OwnerTeaser {
  const hours = Math.round(s.totalHours).toLocaleString("en-US");
  // Only an explicit true means real watch times; older summaries without the flag are date-only
  if (s.hasTimeData !== true) {
    const titles = Math.round(s.distinctTitleDays ?? s.totalEpisodesEstimate);
    return {
      personality: s.personality,
      statValue: titles.toLocaleString("en-US"),
      statLabel: `title${titles === 1 ? "" : "s"} watched, about ${hours} hours`,
    };
  }
  return { personality: s.personality, statValue: `${hours}h`, statLabel: "of Netflix watched" };
}

/**
 * Opaque per-client key for the database-side preview limiter (migration 003): a SHA-256 of the
 * client IP, so the raw IP never reaches the database. Set INVITE_PREVIEW_SALT so the digest can't
 * be reversed by hashing the whole IPv4 space.
 */
export function clientKey(request: NextRequest): string {
  const salt = process.env.INVITE_PREVIEW_SALT ?? "autoplayed-invite-preview";
  return createHash("sha256").update(`${salt}:${clientIp(request)}`).digest("hex");
}

/** Best-effort client key for the in-memory limiter. x-real-ip is set by the platform proxy. */
export function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
