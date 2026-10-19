/**
 * "Is the stored group still mine?" for the reel's last slide and anything else that bakes an
 * invite code into a card. Only a 200 member view confirms; only a 404 means the group (or this
 * user's membership) is gone. 401, 429, 5xx, timeouts and network errors are "unconfirmed":
 * keep the stored group, but don't put its code on anything.
 */
export type GroupCheck = "confirmed" | "gone" | "unconfirmed";

export const GROUP_CHECK_TIMEOUT_MS = 8_000;

export async function checkMyGroup(
  groupId: string,
  { signal, timeoutMs = GROUP_CHECK_TIMEOUT_MS }: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<GroupCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (res.status === 404) return "gone";
    if (!res.ok) return "unconfirmed";
    const data = (await res.json().catch(() => null)) as { preview?: boolean; members?: unknown } | null;
    return data && data.preview !== true && Array.isArray(data.members) ? "confirmed" : "unconfirmed";
  } catch {
    return "unconfirmed";
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
