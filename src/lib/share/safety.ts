/** Invite codes are 8+ lowercase alphanumerics; anything else never goes into a URL or onto the card. */
const INVITE_CODE_RE = /^[a-z0-9]{8,}$/i;

export function isValidInviteCode(code: unknown): code is string {
  return typeof code === "string" && INVITE_CODE_RE.test(code.trim());
}

/** Normalized (trimmed, lowercased) code when valid, else undefined. */
export function safeInviteCode(code: unknown): string | undefined {
  return isValidInviteCode(code) ? code.trim().toLowerCase() : undefined;
}

/**
 * The summary a group sees: everything except the per-session list (titles and timestamps of every
 * binge) and the insights (devices, countries, profiles, relapses, graveyard), which never leave
 * the device. longestBinge stays, since it is one headline stat.
 */
export function toGroupSummary<T extends object>(stats: T): Omit<T, "allBingeSessions" | "insights"> {
  const copy = { ...stats } as Record<string, unknown>;
  delete copy.allBingeSessions;
  delete copy.insights;
  return copy as Omit<T, "allBingeSessions" | "insights">;
}

/**
 * In-app browsers (Instagram, Facebook, WhatsApp, Line, Snapchat, TikTok, Google app) usually ignore
 * blob downloads, so the card is shown as an image to press and hold instead.
 */
const IN_APP_RE = /Instagram|FBAN|FBAV|FB_IAB|WhatsApp|\bLine\/|Snapchat|TikTok|musical_ly|BytedanceWebview|\bGSA\//i;

export function isInAppBrowser(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return IN_APP_RE.test(ua);
}
