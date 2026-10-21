import type { CSSProperties } from "react";
import { NumberField, ReceiptSection } from "./fields";
import {
  CURRENCY_DEFAULTS,
  FILM_HOURS,
  formatMoney,
  parseAmount,
  subscriptionMath,
  subscriptionVerdict,
  trackPercent,
  type Currency,
} from "./money";

/** Label anchoring near the track ends, so a label never pokes past the column at 320px. */
function anchor(percent: number): CSSProperties {
  if (percent < 18) return { left: `${percent}%`, transform: "translateX(-8px)", textAlign: "left" };
  if (percent > 82) return { left: `${percent}%`, transform: "translateX(calc(-100% + 8px))", textAlign: "right" };
  return { left: `${percent}%`, transform: "translateX(-50%)", textAlign: "center" };
}

/**
 * Section 2: what the plan cost per hour actually watched, on a neutral track against two rough
 * references (a cinema ticket and a film rental). No red: section 1's hero is the page's red.
 */
export function SubscriptionMeter({
  hours,
  estimated,
  currency,
  price,
  onPrice,
  months,
  onMonths,
}: {
  hours: number;
  estimated: boolean;
  currency: Currency;
  price: string;
  onPrice: (price: string) => void;
  months: string;
  onMonths: (months: string) => void;
}) {
  const math = subscriptionMath(parseAmount(price), Math.round(parseAmount(months)), hours, currency);
  const approx = estimated ? "~" : "";
  const refs = [
    { label: "Film rental", perHour: math.rentalPerHour, ticket: CURRENCY_DEFAULTS[currency].rental },
    { label: "Cinema ticket", perHour: math.cinemaPerHour, ticket: CURRENCY_DEFAULTS[currency].cinemaTicket },
  ];
  const max = Math.max(math.cinemaPerHour * 1.5, (math.perHour ?? 0) * 1.15);
  const you = math.perHour === null ? null : trackPercent(math.perHour, max);
  const perHourText = math.perHour === null ? "n/a" : `${approx}${formatMoney(math.perHour, currency, { cents: true })}`;

  return (
    <ReceiptSection
      id="receipts-subscription"
      title="Was the subscription worth it?"
      lead="What the plan cost you for every hour you actually watched."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          id="receipts-price"
          label={`Monthly plan price (${currency})`}
          value={price}
          onChange={onPrice}
          step="0.01"
        />
        <NumberField
          id="receipts-months"
          label="Months subscribed"
          value={months}
          onChange={onMonths}
          step="1"
          hint="Starts at the months your file covers."
        />
      </div>

      <dl
        className="grid grid-cols-2 border-y"
        style={{ borderColor: "var(--color-border)" }}
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex min-w-0 flex-col gap-1 py-4 pr-4">
          <dt className="text-sm" style={{ color: "var(--color-muted)" }}>
            Total paid
          </dt>
          <dd data-testid="subscription-total" className="text-headline font-bold tabular-nums">
            {formatMoney(math.totalPaid, currency)}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1 border-l py-4 pl-4" style={{ borderColor: "var(--color-border)" }}>
          <dt className="text-sm" style={{ color: "var(--color-muted)" }}>
            Per hour watched
          </dt>
          <dd data-testid="subscription-per-hour" className="text-headline font-bold tabular-nums">
            {perHourText}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-3">
        <div
          role="img"
          aria-label={`Cost per hour: ${perHourText}. ${refs
            .map((r) => `${r.label} about ${formatMoney(r.perHour, currency, { cents: true })} an hour`)
            .join(". ")}.`}
          className="relative h-24"
        >
          {you !== null && (
            <div className="absolute top-0 whitespace-nowrap text-sm font-semibold tabular-nums" style={anchor(you)}>
              You, {perHourText}/h
            </div>
          )}
          <div
            className="absolute inset-x-0 top-9 h-2 rounded-full"
            style={{ background: "var(--color-track)", boxShadow: "inset 0 0 0 1px var(--color-border)" }}
          />
          {refs.map((r) => {
            const p = trackPercent(r.perHour, max);
            return (
              <div key={r.label}>
                <div
                  className="absolute top-7 h-6 w-px"
                  style={{ left: `${p}%`, background: "var(--color-border-strong)" }}
                />
                <div
                  className="absolute top-14 whitespace-nowrap text-xs leading-tight tabular-nums"
                  style={{ ...anchor(p), color: "var(--color-muted)" }}
                >
                  {r.label}
                  <br />
                  {formatMoney(r.perHour, currency, { cents: true })}/h
                </div>
              </div>
            );
          })}
          {you !== null && (
            <div
              data-testid="meter-marker"
              className="absolute top-[30px] h-5 w-5 -translate-x-1/2 rounded-full motion-safe:transition-[left] motion-safe:duration-300"
              style={{
                left: `${you}%`,
                background: "var(--color-text)",
                boxShadow: "0 0 0 4px var(--color-bg)",
              }}
            />
          )}
        </div>
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
          Rough references, not live prices: a cinema ticket at about{" "}
          {formatMoney(refs[1].ticket, currency)} and a film rental at about {formatMoney(refs[0].ticket, currency)},
          each for a ~{FILM_HOURS}h film.
        </p>
      </div>

      <p data-testid="subscription-verdict" className="text-lg font-semibold" style={{ textWrap: "balance" }}>
        {subscriptionVerdict(math, currency, approx)}
      </p>
    </ReceiptSection>
  );
}
