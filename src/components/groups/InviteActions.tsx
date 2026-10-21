"use client";

import { useEffect, useRef, useState } from "react";
import { useAutoplayedStore } from "@/lib/store";
import { renderShareImage } from "@/lib/share/renderShareImage";
import { displayInviteCode } from "@/lib/supabase/groups";
import {
  INVITE_ACTIONS,
  inviteShareMessage,
  inviteShareText,
  inviteShareTitle,
  inviteUrl,
} from "@/lib/copy/invite";
import { CheckIcon, CopyIcon, UserPlusIcon } from "./icons";

// Kept for older imports; the copy module owns invite links now
export { inviteUrl };

async function writeClipboard(text: string) {
  if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
  await navigator.clipboard.writeText(text);
}

function errorName(err: unknown) {
  return err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
}

interface InviteActionsProps {
  code: string;
  groupName: string;
  /** Share is the screen's one red action (fresh group); otherwise both buttons are secondary */
  sharePrimary?: boolean;
  /** The card says "Join my group" for the creator, "Join our group" for everyone else */
  ownedByMe?: boolean;
  /** Copy code only: for pages whose own share action already carries the code (compare) */
  copyOnly?: boolean;
}

type Status = { tone: "ok" | "error"; text: string } | null;
// The card is built ahead of the click so navigator.share runs inside the tap (iOS needs that)
type Card = { kind: "pending" } | { kind: "ready"; file: File } | { kind: "failed" };

export default function InviteActions({
  code,
  groupName,
  sharePrimary = false,
  ownedByMe = false,
  copyOnly = false,
}: InviteActionsProps) {
  const wrappedStats = useAutoplayedStore((s) => s.wrappedStats);
  const [status, setStatus] = useState<Status>(null);
  const [card, setCard] = useState<Card>({ kind: "pending" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!wrappedStats || copyOnly) return;
    let cancelled = false;
    renderShareImage(wrappedStats, { inviteCode: code, ownedByMe })
      .then((blob) => {
        if (cancelled) return;
        setCard({ kind: "ready", file: new File([blob], "autoplayed-invite.png", { type: "image/png" }) });
      })
      .catch(() => {
        if (!cancelled) setCard({ kind: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [wrappedStats, code, ownedByMe, copyOnly]);

  function announce(next: Status) {
    setStatus(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), 4000);
  }

  // Shown and copied UPPERCASE; joining accepts any case
  const shownCode = displayInviteCode(code);

  async function copyCode() {
    try {
      await writeClipboard(shownCode);
      announce({ tone: "ok", text: "Code copied" });
    } catch {
      announce({ tone: "error", text: `Couldn't copy. Select the code and copy it by hand: ${shownCode}` });
    }
  }

  async function copyLink(okText: string, text: string) {
    try {
      await writeClipboard(text);
      announce({ tone: "ok", text: okText });
    } catch {
      announce({ tone: "error", text: `Couldn't copy the link. Send the code instead: ${shownCode}` });
    }
  }

  async function share() {
    const url = inviteUrl(code);
    const title = inviteShareTitle(groupName);
    const shareInput = { code, groupName, personality: wrappedStats?.personality ?? null };
    const text = inviteShareText(shareInput);
    // Clipboard fallbacks carry the roast line and the link, so a paste works on its own
    const message = inviteShareMessage({ ...shareInput, url });
    const cardFailed = card.kind === "failed";

    // No await before navigator.share: the share sheet needs the tap's transient activation
    if (card.kind === "ready" && typeof navigator.share === "function" && navigator.canShare?.({ files: [card.file] })) {
      try {
        await navigator.share({ files: [card.file], title, text, url });
        return;
      } catch (err) {
        const name = errorName(err);
        if (name === "AbortError") return;
        await copyLink(
          name === "NotAllowedError"
            ? "Card ready, sharing was blocked. Link copied instead."
            : "Couldn't open sharing. Invite link copied instead.",
          message
        );
        return;
      }
    }

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        if (cardFailed) announce({ tone: "error", text: "Couldn't make the card, so the invite went without it." });
        return;
      } catch (err) {
        const name = errorName(err);
        if (name === "AbortError") return;
        if (name === "NotAllowedError") {
          await copyLink("Sharing was blocked. Invite link copied instead.", message);
          return;
        }
      }
    }

    await copyLink(
      cardFailed
        ? "Couldn't make the card. Invite link copied instead."
        : "Invite link copied. Paste it in your group chat.",
      message
    );
  }

  const copied = status?.tone === "ok" && status.text === "Code copied";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        {!copyOnly && (
          <button
            type="button"
            onClick={share}
            className={`${sharePrimary ? "btn-primary" : "btn-secondary"} flex-1 px-6 py-3`}
          >
            <UserPlusIcon />
            {INVITE_ACTIONS.shareInvite}
          </button>
        )}
        <button
          type="button"
          onClick={copyCode}
          className={`btn-secondary px-6 py-3 ${copyOnly ? "self-start" : "flex-1"}`}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <p
        aria-live="polite"
        role={status?.tone === "error" ? "alert" : undefined}
        className="text-sm min-h-[1.25rem]"
        style={{ color: status?.tone === "error" ? "var(--color-red-text)" : "var(--color-text-secondary)" }}
      >
        {status?.text ?? ""}
      </p>
    </div>
  );
}
