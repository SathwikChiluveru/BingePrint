import type { WrappedStats } from "@/types";

// "The Binge Lord" -> "The Binge Lord's crew"; tolerates personalities without a leading "The"
export function suggestGroupName(personality: string | undefined) {
  if (!personality) return "";
  const base = personality.replace(/^the\s+/i, "").trim();
  return base ? `The ${base}'s crew` : "";
}

// Only an explicit true means real watch times. Older wrapped_data without the flag is treated as
// date-only, so its hours are never compared as if they were exact.
export function memberHasTime(data: Pick<WrappedStats, "hasTimeData">) {
  return data.hasTimeData === true;
}

type TitleSource = Pick<WrappedStats, "totalEpisodesEstimate"> & { distinctTitleDays?: number };

/**
 * Titles watched, counted the same way for every export: unique title+day pairs when the stats
 * carry them (timed exports log one row per sitting), else the row count from older stats.
 */
export function memberTitles(data: TitleSource) {
  const raw = typeof data.distinctTitleDays === "number" ? data.distinctTitleDays : data.totalEpisodesEstimate;
  return Math.max(0, Math.round(Number.isFinite(raw) ? raw : 0));
}

/** Stats saved before distinctTitleDays existed, from a timed export: their title count includes repeat sittings. */
export function memberTitlesInflated(data: TitleSource & Pick<WrappedStats, "hasTimeData">) {
  return typeof data.distinctTitleDays !== "number" && data.hasTimeData === true;
}

// "1,234h" for timed members, "~1,234h" when hours were estimated from dates only
export function formatMemberHours(data: Pick<WrappedStats, "totalHours" | "hasTimeData">) {
  const hours = Math.round(data.totalHours).toLocaleString();
  return memberHasTime(data) ? `${hours}h` : `~${hours}h`;
}

// One-line summary for a member row: date-only members lead with titles, since their hours are a guess
export function memberSummary(
  data: Pick<WrappedStats, "totalHours" | "hasTimeData" | "totalEpisodesEstimate" | "personality"> & {
    distinctTitleDays?: number;
  }
) {
  if (memberHasTime(data)) return `${formatMemberHours(data)} · ${data.personality}`;
  const n = memberTitles(data);
  return `${n.toLocaleString()} ${n === 1 ? "title" : "titles"} · ${formatMemberHours(data)} · ${data.personality}`;
}

// First name from the auth profile, else the email's local part, so the nickname field starts filled
export function suggestNickname(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null) {
  if (!user) return "";
  const meta = user.user_metadata ?? {};
  const fullName = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim() !== "");
  const first = fullName?.trim().split(/\s+/)[0];
  const fromEmail = user.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim().split(/\s+/)[0];
  const raw = first || fromEmail || "";
  if (!raw) return "";
  return (raw.charAt(0).toUpperCase() + raw.slice(1)).slice(0, 30);
}

type FingerprintSource = Pick<
  WrappedStats,
  "totalSeconds" | "totalEpisodesEstimate" | "uniqueShowsCount" | "personality" | "hasTimeData"
> & { distinctTitleDays?: number };

/**
 * Cheap identity for a reel's headline numbers. The server stores a stripped summary, so deep
 * equality never holds; these fields survive stripping and change whenever a different file is used.
 */
export function statsFingerprint(d: FingerprintSource) {
  return [
    Math.round(Number(d.totalSeconds) || 0),
    Math.round(Number(d.totalEpisodesEstimate) || 0),
    typeof d.distinctTitleDays === "number" ? d.distinctTitleDays : "",
    Math.round(Number(d.uniqueShowsCount) || 0),
    d.personality,
    d.hasTimeData === true ? 1 : 0,
  ].join("|");
}
