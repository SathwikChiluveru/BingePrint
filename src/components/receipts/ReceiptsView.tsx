"use client";

import { useEffect, useState } from "react";
import type { WrappedStats } from "@/types";
import AppNav from "@/components/AppNav";
import { LockIcon } from "@/components/landing/icons";
import { AccountCheck } from "./AccountCheck";
import { OpportunityCost } from "./OpportunityCost";
import { SubscriptionMeter } from "./SubscriptionMeter";
import { CURRENCY_DEFAULTS, browserCurrency, loadPrefs, savePrefs, type Currency, type ReceiptPrefs } from "./money";

/** Months the file covers: insights when present, else the week span, else a year. */
export function defaultMonths(stats: WrappedStats): number {
  if (stats.insights?.monthsSpanned) return Math.max(1, Math.round(stats.insights.monthsSpanned));
  if (stats.weeksSpanned) return Math.max(1, Math.round((stats.weeksSpanned * 7) / 30.44));
  return 12;
}

/**
 * The receipts: an on-device read of the reel's numbers (what the hours and the plan cost, and who
 * else is on the account). Mounted only on the client (prefs come from localStorage).
 */
export function ReceiptsView({ stats, sessionId }: { stats: WrappedStats; sessionId: string }) {
  const [prefs, setPrefs] = useState<ReceiptPrefs>(() => loadPrefs(browserCurrency()));
  const [months, setMonths] = useState(() => String(defaultMonths(stats)));
  useEffect(() => savePrefs(prefs), [prefs]);

  const hours = Math.max(0, stats.totalSeconds) / 3600;
  const estimated = stats.hasTimeData !== true;

  const changeCurrency = (next: Currency) =>
    setPrefs((p) => {
      // A field still at the old currency's default moves to the new one's; typed values stay.
      const was = CURRENCY_DEFAULTS[p.currency];
      const now = CURRENCY_DEFAULTS[next];
      return {
        currency: next,
        rate: p.rate === String(was.rate) ? String(now.rate) : p.rate,
        price: p.price === String(was.price) ? String(now.price) : p.price,
      };
    });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      <AppNav secondary={{ href: `/wrapped/${encodeURIComponent(sessionId)}`, label: "My reel" }} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-6 py-12 md:py-16">
        <header className="flex flex-col gap-3">
          <h1 className="text-headline font-bold">The receipts</h1>
          <p className="max-w-[60ch] text-lg" style={{ color: "var(--color-text-secondary)" }}>
            The math your reel was too polite to show: what the hours cost, what the plan cost, and who else has
            been watching.
          </p>
          <p className="flex items-start gap-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            <span className="mt-0.5 shrink-0" style={{ color: "var(--color-success)" }}>
              <LockIcon size={16} />
            </span>
            <span>Nothing on this page leaves your device. Groups never see it.</span>
          </p>
        </header>

        <OpportunityCost
          hours={hours}
          estimated={estimated}
          currency={prefs.currency}
          onCurrency={changeCurrency}
          rate={prefs.rate}
          onRate={(rate) => setPrefs((p) => ({ ...p, rate }))}
        />
        <SubscriptionMeter
          hours={hours}
          estimated={estimated}
          currency={prefs.currency}
          price={prefs.price}
          onPrice={(price) => setPrefs((p) => ({ ...p, price }))}
          months={months}
          onMonths={setMonths}
        />
        <AccountCheck insights={stats.insights} />

        <p className="border-t pt-6 text-xs" style={{ color: "var(--color-muted)", borderColor: "var(--color-border)" }}>
          Autoplayed is not affiliated with Netflix.
        </p>
      </main>
    </div>
  );
}
