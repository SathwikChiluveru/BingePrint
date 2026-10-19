"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "@/types";
import { isInAppBrowser, safeInviteCode } from "@/lib/share/safety";
import { inviteUrl } from "@/lib/copy/invite";
import { ShareIcon } from "@/components/groups/icons";
import { cardPunchline, unitLabel, type Comparison } from "./compareModel";
import { compareCardCaption, renderCompareImage, type CompareImageInput } from "./renderCompareImage";

const FILENAME = "autoplayed-standings.png";
const PRESS_AND_HOLD = "Press and hold the card to save it.";

type ShareState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; message: string }
  // In-app browsers ignore downloads: the PNG is shown to press and hold instead
  | { kind: "preview"; message: string }
  | { kind: "error"; message: string };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isAbort(err: unknown) {
  return err instanceof DOMException && err.name === "AbortError";
}

async function copy(text: string) {
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * "Share the standings": a head-to-head PNG plus share text and the invite link. The PNG is
 * rendered ahead of the tap so navigator.share() runs inside the tap's activation (iOS drops it
 * across a slow await). In-app browsers get the PNG to press and hold, like the reel's last slide.
 */
export default function CompareShare({
  group,
  comparison,
  ownedByMe,
  primary = true,
}: {
  group: Group;
  comparison: Comparison;
  ownedByMe: boolean;
  /** False when another action owns the page's red (the owner adding their own reel) */
  primary?: boolean;
}) {
  const code = safeInviteCode(group.invite_code) ?? "";
  const input = useMemo<CompareImageInput>(() => {
    const { leader, runnerUp, gap, metric } = comparison;
    return {
      groupName: group.name,
      leaderName: leader.member.nickname,
      leaderValue: leader.value,
      unit: unitLabel(metric, leader.value),
      runnerUpName: runnerUp?.member.nickname ?? null,
      gap,
      gapUnit: unitLabel(metric, gap),
      punchline: cardPunchline(comparison),
      inviteCode: code,
      ownedByMe,
    };
  }, [comparison, group.name, code, ownedByMe]);

  const [share, setShare] = useState<ShareState>({ kind: "idle" });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const pendingRef = useRef<Promise<Blob> | null>(null);

  useEffect(() => {
    let current = true;
    blobRef.current = null;
    const pending = renderCompareImage(input);
    pendingRef.current = pending;
    pending.then(
      (blob) => {
        if (current) blobRef.current = blob;
      },
      () => {
        // Retried on tap
        if (current) pendingRef.current = null;
      }
    );
    return () => {
      current = false;
    };
  }, [input]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const shownCode = code.toUpperCase();
  const url = code ? inviteUrl(code) : "";
  const caption = compareCardCaption(input);
  const text = `${input.leaderName} watched the most in ${group.name}: ${input.leaderValue.toLocaleString()} ${input.unit}, ${caption.charAt(0).toLowerCase()}${caption.slice(1)}. Think you'd lose? Join on Autoplayed with code ${shownCode}.`;

  async function fallback(blob: Blob, blocked: boolean) {
    // A blob download silently does nothing in most in-app browsers, so never claim it worked there
    const inApp = isInAppBrowser();
    if (inApp) setPreviewUrl(URL.createObjectURL(blob));
    else downloadBlob(blob, FILENAME);
    const copied = url ? await copy(`${text} ${url}`) : false;
    const linkNote = copied ? " Invite link copied." : "";
    if (inApp) {
      setShare({ kind: "preview", message: `${PRESS_AND_HOLD}${linkNote}` });
      return;
    }
    setShare({
      kind: "done",
      message: blocked
        ? `Sharing was blocked, so the card went to your downloads.${linkNote}`
        : `Card saved to your downloads.${linkNote}`,
    });
  }

  /** Reaches navigator.share() before any await, so it stays inside the tap's activation. */
  function deliver(blob: Blob) {
    const file = new File([blob], FILENAME, { type: "image/png" });
    const title = `${group.name} on Autoplayed`;
    const full: ShareData = { files: [file], title, text, ...(url ? { url } : {}) };
    const filesOnly: ShareData = { files: [file], title };
    const data =
      typeof navigator.canShare === "function"
        ? navigator.canShare(full)
          ? full
          : navigator.canShare(filesOnly)
            ? filesOnly
            : null
        : null;
    if (!data) {
      void fallback(blob, false);
      return;
    }
    setShare({ kind: "busy" });
    navigator.share(data).then(
      () => setShare({ kind: "done", message: "Standings shared." }),
      (err: unknown) => {
        if (isAbort(err)) {
          setShare({ kind: "idle" });
          return;
        }
        void fallback(blob, true);
      }
    );
  }

  function handleShare() {
    if (share.kind === "busy") return;
    const ready = blobRef.current;
    if (ready) {
      deliver(ready);
      return;
    }
    // Still rendering, or the render failed: render now; a late share() falls back to a download
    setShare({ kind: "busy" });
    const pending = pendingRef.current ?? renderCompareImage(input);
    pendingRef.current = pending;
    pending.then(
      (blob) => {
        blobRef.current = blob;
        deliver(blob);
      },
      () => {
        pendingRef.current = null;
        setShare({ kind: "error", message: "Couldn't make the card. Try again." });
      }
    );
  }

  const busy = share.kind === "busy";

  return (
    <div className="flex flex-col gap-3">
      {previewUrl && share.kind === "preview" && (
        // The PNG itself, so press-and-hold saves the real card in in-app browsers
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={`Standings card: ${input.leaderName} watched the most in ${group.name}. ${PRESS_AND_HOLD}`}
          width={1080}
          height={1920}
          className="mx-auto h-auto w-auto max-w-full max-h-[60vh] rounded-[20px]"
          style={{ border: "1px solid var(--color-border-strong)", WebkitTouchCallout: "default" }}
        />
      )}
      <button
        type="button"
        onClick={handleShare}
        aria-disabled={busy || undefined}
        aria-busy={busy}
        className={`${primary ? "btn-primary" : "btn-secondary"} w-full gap-2 px-6 py-3 aria-disabled:cursor-wait aria-disabled:opacity-60`}
      >
        <ShareIcon />
        {busy ? "Making the card…" : "Share the standings"}
      </button>
      <p
        aria-live="polite"
        role={share.kind === "error" ? "alert" : undefined}
        className="min-h-[1.25rem] text-sm"
        style={{
          color:
            share.kind === "error"
              ? "var(--color-red-text)"
              : share.kind === "done" || share.kind === "preview"
                ? "var(--color-success)"
                : "var(--color-text-secondary)",
        }}
      >
        {share.kind === "done" || share.kind === "preview" || share.kind === "error" ? share.message : ""}
      </p>
    </div>
  );
}
