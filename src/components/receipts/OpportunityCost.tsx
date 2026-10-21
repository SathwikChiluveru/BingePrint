import { CurrencySelect, NumberField, ReceiptSection } from "./fields";
import { formatCount, formatMoney, hourEquivalents, parseAmount, type Currency } from "./money";

/**
 * Section 1: hours watched times an hourly rate. The money hero is the page's one red thing.
 * Estimated hours (date-only exports) carry "~" on every derived number and one method note.
 */
export function OpportunityCost({
  hours,
  estimated,
  currency,
  onCurrency,
  rate,
  onRate,
}: {
  hours: number;
  estimated: boolean;
  currency: Currency;
  onCurrency: (currency: Currency) => void;
  rate: string;
  onRate: (rate: string) => void;
}) {
  const hourly = parseAmount(rate);
  const earned = hours * hourly;
  const approx = estimated ? "~" : "";
  const equivalents = hourEquivalents(hours).filter((e) => e.count > 0);

  return (
    <ReceiptSection
      id="receipts-opportunity"
      title="What your hours were worth"
      lead="Put a price on your time and see what the couch cost you."
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <NumberField id="receipts-rate" label="Your hourly rate" value={rate} onChange={onRate} step="0.5" />
        <CurrencySelect id="receipts-currency" value={currency} onChange={onCurrency} />
      </div>

      <div className="relative flex flex-col gap-2" aria-live="polite" aria-atomic="true">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-6 -top-8 -bottom-8 w-[min(calc(100%+3rem),30rem)]"
          style={{ background: "var(--glow-hero)" }}
        />
        <p className="relative text-lg" style={{ color: "var(--color-text-secondary)" }}>
          You could&rsquo;ve made
        </p>
        <p
          data-testid="opportunity-total"
          className="relative text-display font-black tabular-nums whitespace-nowrap"
          style={{ color: "var(--color-red)" }}
        >
          {approx}
          {formatMoney(earned, currency, { cents: earned > 0 && earned < 100 })}
        </p>
        <p className="relative tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
          {approx}
          {formatCount(hours)} hours at {formatMoney(hourly, currency, { cents: hourly % 1 !== 0 })} an hour.
        </p>
        {estimated && (
          <p className="relative text-sm" style={{ color: "var(--color-muted)" }}>
            Your file has dates only, so these are estimated hours, worked out from what you watched.
          </p>
        )}
      </div>

      {equivalents.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Or, in hours you&rsquo;ll never get back:
          </p>
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {equivalents.map((e) => (
              <li
                key={e.text}
                className="flex items-baseline gap-3 py-3"
                style={{ borderColor: "var(--color-border)" }}
              >
                <span className="min-w-[4.5rem] text-title font-semibold tabular-nums">
                  {approx}
                  {formatCount(e.count)}
                </span>
                <span style={{ color: "var(--color-text-secondary)" }}>{e.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ReceiptSection>
  );
}
