// Money math for the receipts page. Pure functions (no React), so the numbers are testable alone.
// Everything here runs on the viewer's device: nothing is sent anywhere.

export const CURRENCIES = ["USD", "EUR", "GBP", "INR", "SGD"] as const;
export type Currency = (typeof CURRENCIES)[number];

interface CurrencyDefaults {
  /** Hourly rate the converter starts at */
  rate: number;
  /** A typical Netflix plan price (Standard, roughly), per month */
  price: number;
  /** Rough cinema ticket price, for a ~2h film */
  cinemaTicket: number;
  /** Rough digital film rental price, for a ~2h film */
  rental: number;
}

/** Rough local references, not live prices. The page labels them as rough. */
export const CURRENCY_DEFAULTS: Record<Currency, CurrencyDefaults> = {
  USD: { rate: 15, price: 17.99, cinemaTicket: 12, rental: 4 },
  EUR: { rate: 15, price: 13.99, cinemaTicket: 11, rental: 4 },
  GBP: { rate: 12, price: 12.99, cinemaTicket: 10, rental: 4 },
  INR: { rate: 200, price: 499, cinemaTicket: 250, rental: 120 },
  SGD: { rate: 15, price: 17.98, cinemaTicket: 14, rental: 5 },
};

/** Hours in a reference film (cinema ticket, rental). */
export const FILM_HOURS = 2;

const EURO_REGIONS = new Set([
  "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK",
]);

/** A currency guessed from a BCP 47 tag's region ("en-GB" is GBP). Unknown regions fall back to USD. */
export function currencyForLocale(locale: string | undefined | null): Currency {
  if (!locale) return "USD";
  const region = locale.split(/[-_]/).slice(1).find((part) => /^[A-Za-z]{2}$/.test(part))?.toUpperCase();
  if (!region) return "USD";
  if (region === "GB") return "GBP";
  if (region === "IN") return "INR";
  if (region === "SG") return "SGD";
  if (EURO_REGIONS.has(region)) return "EUR";
  return "USD";
}

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

/** "$12,345" for big sums, "$0.21" when cents matter. */
export function formatMoney(amount: number, currency: Currency, { cents }: { cents?: boolean } = {}): string {
  const showCents = cents ?? Math.abs(amount) < 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatCount(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Text from a number field: blank, negative or junk count as 0. */
export function parseAmount(text: string): number {
  const n = Number.parseFloat(text.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export interface Equivalent {
  /** Rounded down count, e.g. 62 */
  count: number;
  /** Rest of the line after the number, already pluralized */
  text: string;
}

const EQUIVALENTS: { hours: number; one: string; many: string }[] = [
  { hours: 8, one: "night of 8 hours' sleep", many: "nights of 8 hours' sleep" },
  { hours: 40, one: "full 40-hour work week", many: "full 40-hour work weeks" },
  { hours: 4.5, one: "marathon, at a 4.5-hour jog", many: "marathons, at a 4.5-hour jog" },
];

/** The same hours, measured in things you could have done instead. */
export function hourEquivalents(hours: number): Equivalent[] {
  return EQUIVALENTS.map(({ hours: per, one, many }) => {
    const count = Math.floor(hours / per);
    return { count, text: count === 1 ? one : many };
  });
}

export interface SubscriptionMath {
  totalPaid: number;
  /** null when no hours were watched (cost per hour is undefined) */
  perHour: number | null;
  cinemaPerHour: number;
  rentalPerHour: number;
}

export function subscriptionMath(price: number, months: number, hours: number, currency: Currency): SubscriptionMath {
  const totalPaid = Math.max(0, price) * Math.max(0, months);
  const { cinemaTicket, rental } = CURRENCY_DEFAULTS[currency];
  return {
    totalPaid,
    perHour: hours > 0 ? totalPaid / hours : null,
    cinemaPerHour: cinemaTicket / FILM_HOURS,
    rentalPerHour: rental / FILM_HOURS,
  };
}

/** One roast line for the cost per hour. */
export function subscriptionVerdict(math: SubscriptionMath, currency: Currency, approx = ""): string {
  if (math.perHour === null) return "No hours watched, so every month was a donation.";
  const rate = approx + formatMoney(math.perHour, currency, { cents: true });
  if (math.perHour === 0) return "Free viewing. Whoever pays for this account deserves a thank-you.";
  if (math.perHour < math.rentalPerHour / 2) return `At ${rate} an hour, Netflix should be paying you.`;
  if (math.perHour < math.rentalPerHour) return `At ${rate} an hour, you got your money's worth. Your free time didn't.`;
  if (math.perHour < math.cinemaPerHour) return `At ${rate} an hour, still cheaper than a cinema seat. Just.`;
  return `At ${rate} an hour, a cinema ticket was the better deal. Watch more or cancel.`;
}

/** Where a value sits on a 0..max track, as a 0-100 percent. */
export function trackPercent(value: number, max: number): number {
  if (!(max > 0)) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

/** Hours for display: "1,234h" (whole hours), or minutes under an hour. */
export function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 1) return `${formatCount(Math.round(hours))}h`;
  return `${formatCount(Math.round(seconds / 60))}m`;
}

// Per-device preferences: currency, hourly rate and plan price. Storage can be missing or blocked
// (private windows), so every read and write is guarded and the page works without it.
export const PREFS_KEY = "autoplayed-receipts";

export interface ReceiptPrefs {
  currency: Currency;
  rate: string;
  price: string;
}

export function loadPrefs(fallbackCurrency: Currency): ReceiptPrefs {
  const defaults = CURRENCY_DEFAULTS[fallbackCurrency];
  const base: ReceiptPrefs = { currency: fallbackCurrency, rate: String(defaults.rate), price: String(defaults.price) };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<ReceiptPrefs>;
    const currency = isCurrency(saved.currency) ? saved.currency : fallbackCurrency;
    const d = CURRENCY_DEFAULTS[currency];
    return {
      currency,
      rate: typeof saved.rate === "string" ? saved.rate : String(d.rate),
      price: typeof saved.price === "string" ? saved.price : String(d.price),
    };
  } catch {
    return base;
  }
}

export function savePrefs(prefs: ReceiptPrefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: the numbers still work for this visit.
  }
}

export function browserCurrency(): Currency {
  try {
    return currencyForLocale(typeof navigator === "undefined" ? null : navigator.language);
  } catch {
    return "USD";
  }
}
