// Shared by the login page and the auth callback: only same-origin relative paths are honoured as
// a post-sign-in destination, so a crafted ?next= can never bounce the user to another site.

export const DEFAULT_NEXT = "/upload";

const PROBE_ORIGIN = "http://autoplayed.invalid";

/** Returns a safe relative path (pathname + search + hash), or null when `raw` is not one. */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Must be a rooted path. "//host" and "/\host" are protocol-relative in browsers.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  // Control characters and backslashes can be normalised into a different URL by browsers.
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null;
  try {
    const url = new URL(raw, PROBE_ORIGIN);
    if (url.origin !== PROBE_ORIGIN) return null;
    // Dot segments can normalise into a protocol-relative path: "/..//evil.com" -> "//evil.com"
    if (url.pathname.startsWith("//")) return null;
    // Never loop back into the auth flow itself.
    if (url.pathname.startsWith("/auth/")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
