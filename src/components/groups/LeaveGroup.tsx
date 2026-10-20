"use client";

import { useEffect, useRef, useState } from "react";
import { leaveGroup } from "@/lib/supabase/groups";
import { leaveGroupConfirmLine, leaveGroupLabel } from "@/lib/copy/invite";

/**
 * "Leave {group}": a quiet text button at the bottom of the member view that opens an inline
 * confirm (no modal). Confirming calls DELETE /api/groups/[id]/members/me; on success the caller
 * forgets the stored group and routes away. Errors stay inline and keep the confirm open.
 */
export default function LeaveGroup({
  groupId,
  groupName,
  ownedByMe,
  onLeft,
}: {
  groupId: string;
  groupName: string;
  ownedByMe: boolean;
  onLeft: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const confirmRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const label = leaveGroupLabel(groupName);

  useEffect(() => {
    if (confirming) {
      wasOpen.current = true;
      confirmRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      openRef.current?.focus();
    }
  }, [confirming]);

  async function confirm() {
    if (leaving) return;
    setLeaving(true);
    setError("");
    const result = await leaveGroup(groupId);
    if (result.ok) {
      onLeft();
      return;
    }
    setLeaving(false);
    setError(result.message);
  }

  return (
    <section aria-label={label} className="mt-16 border-t pt-6" style={{ borderColor: "var(--color-border)" }}>
      {!confirming ? (
        <button
          ref={openRef}
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex min-h-[44px] items-center text-sm underline underline-offset-4 transition-colors hover:text-[var(--color-text)]"
          style={{ color: "var(--color-muted)" }}
        >
          {label}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {leaveGroupConfirmLine(ownedByMe)}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              ref={confirmRef}
              type="button"
              onClick={confirm}
              disabled={leaving}
              className="btn-secondary px-5 py-3"
            >
              {leaving ? "Leaving…" : label}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setError("");
              }}
              disabled={leaving}
              className="min-h-[44px] px-3 text-sm"
              style={{ color: "var(--color-muted)" }}
            >
              Stay
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm" style={{ color: "var(--color-red-text)" }}>
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
