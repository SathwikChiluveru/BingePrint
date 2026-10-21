"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { useAutoplayedStore } from "@/lib/store";
import { upgradeStoredStats } from "@/lib/csv/stats";
import { ReceiptsView } from "@/components/receipts/ReceiptsView";
import { ReceiptsMissing } from "@/components/receipts/ReceiptsMissing";

const noopSubscribe = () => () => {};

export default function ReceiptsPage() {
  const params = useParams<{ sessionId: string }>();
  const storedStats = useAutoplayedStore((s) => s.wrappedStats);
  const stats = useMemo(() => (storedStats ? upgradeStoredStats(storedStats) : storedStats), [storedStats]);
  const sessionId = useAutoplayedStore((s) => s.sessionId);
  // Stats come from localStorage: render nothing on the server and decide after hydration.
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  if (!isClient) return <main className="min-h-screen" style={{ background: "var(--color-bg)" }} />;
  if (!stats || !sessionId || sessionId !== params.sessionId) {
    return <ReceiptsMissing savedSessionId={stats ? sessionId : null} />;
  }
  return <ReceiptsView stats={stats} sessionId={sessionId} />;
}
