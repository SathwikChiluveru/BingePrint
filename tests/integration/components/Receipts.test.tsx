// The receipts page body (ReceiptsView): converter and plan math, the account check's states.
// Stats come from the synthetic fixtures; insights are hand-built so the engine's own heuristics
// don't decide what this test sees.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Insights, WrappedStats } from "@/types";
import { dateOnlyCsv, statsFrom, timedCsv } from "../fixtures/csv";
import { primaries, renderCalm, stubBrowser } from "./helpers";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: ReactNode; prefetch?: boolean }) => {
    void _p;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

import { ReceiptsView, defaultMonths } from "@/components/receipts/ReceiptsView";
import { PREFS_KEY, currencyForLocale, formatMoney, subscriptionMath, subscriptionVerdict } from "@/components/receipts/money";

function insights(over: Partial<Insights> = {}): Insights {
  return {
    relapses: [],
    graveyard: [],
    graveyardCount: 0,
    firstWatched: "2024-03-01",
    lastWatched: "2024-03-09",
    monthsSpanned: 7,
    hourHeatmap: null,
    devices: [
      { name: "Synthetic TV", seconds: 36_000, sessions: 12, firstSeen: "2024-03-01", lastSeen: "2024-09-01" },
      { name: "Chrome PC", seconds: 4_000, sessions: 2, firstSeen: "2024-05-01", lastSeen: "2024-05-02" },
    ],
    countries: [{ name: "US (United States)", seconds: 40_000, sessions: 14, firstSeen: "2024-03-01", lastSeen: "2024-09-01" }],
    profiles: [{ name: "Tester", seconds: 40_000, sessions: 14, firstSeen: "2024-03-01", lastSeen: "2024-09-01" }],
    sharing: { suspicious: false, signals: [] },
    ...over,
  };
}

function withInsights(stats: WrappedStats, value: Insights | undefined): WrappedStats {
  return { ...stats, insights: value };
}

const timed = statsFrom(timedCsv());
const hours = timed.totalSeconds / 3600;

function renderView(stats: WrappedStats) {
  return renderCalm(<ReceiptsView stats={stats} sessionId="sess1" />);
}

beforeEach(() => {
  stubBrowser();
  window.localStorage.clear();
  Object.defineProperty(window.navigator, "language", { configurable: true, value: "en-US" });
});
afterEach(cleanup);

describe("Receipts page", () => {
  it("says up top that nothing leaves the device, and links back to the reel", () => {
    renderView(withInsights(timed, insights()));
    expect(screen.getByText("Nothing on this page leaves your device. Groups never see it.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My reel" })).toHaveAttribute("href", "/wrapped/sess1");
  });

  it("multiplies hours by the hourly rate as the rate changes, and remembers the rate", () => {
    renderView(withInsights(timed, insights()));
    const total = screen.getByTestId("opportunity-total");
    expect(total).toHaveTextContent(formatMoney(hours * 15, "USD", { cents: hours * 15 < 100 }));

    fireEvent.change(screen.getByLabelText("Your hourly rate"), { target: { value: "40" } });
    expect(total).toHaveTextContent(formatMoney(hours * 40, "USD", { cents: hours * 40 < 100 }));
    expect(total.textContent).not.toMatch(/^~/);
    expect(JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}")).toMatchObject({ rate: "40", currency: "USD" });
  });

  it("restores a saved rate and currency", () => {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ currency: "GBP", rate: "30", price: "9.99" }));
    renderView(withInsights(timed, insights()));
    expect(screen.getByLabelText("Your hourly rate")).toHaveValue(30);
    expect(screen.getByLabelText("Currency")).toHaveValue("GBP");
    expect(screen.getByTestId("opportunity-total")).toHaveTextContent(formatMoney(hours * 30, "GBP", { cents: hours * 30 < 100 }));
  });

  it("marks estimated hours with ~ for date-only files", () => {
    const quick = statsFrom(dateOnlyCsv());
    renderView(withInsights(quick, insights({ devices: null, countries: null, profiles: null, sharing: null })));
    expect(screen.getByTestId("opportunity-total").textContent).toMatch(/^~/);
    expect(screen.getByText(/estimated hours/)).toBeInTheDocument();
  });

  it("works out total paid and cost per hour watched from price and months", () => {
    renderView(withInsights(timed, insights()));
    // Months default to the span the file covers
    expect(screen.getByLabelText("Months subscribed")).toHaveValue(7);

    fireEvent.change(screen.getByLabelText("Monthly plan price (USD)"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Months subscribed"), { target: { value: "6" } });
    expect(screen.getByTestId("subscription-total")).toHaveTextContent(formatMoney(60, "USD"));
    expect(screen.getByTestId("subscription-per-hour")).toHaveTextContent(formatMoney(60 / hours, "USD", { cents: true }));
    const math = subscriptionMath(10, 6, hours, "USD");
    expect(screen.getByTestId("subscription-verdict")).toHaveTextContent(subscriptionVerdict(math, "USD"));
  });

  it("roasts a cheap hour and calls an expensive one", () => {
    const cheap = subscriptionMath(17.99, 1, 100, "USD");
    expect(subscriptionVerdict(cheap, "USD")).toBe(`At ${formatMoney(0.1799, "USD", { cents: true })} an hour, Netflix should be paying you.`);
    const pricey = subscriptionMath(17.99, 12, 10, "USD");
    expect(subscriptionVerdict(pricey, "USD")).toMatch(/cinema ticket was the better deal/);
    expect(subscriptionMath(10, 3, 0, "USD").perHour).toBeNull();
  });

  it("lists every signal and what to do when the account looks shared", () => {
    renderView(
      withInsights(
        timed,
        insights({
          sharing: {
            suspicious: true,
            signals: [
              { kind: "overlap", detail: "Two devices played at once on 3 Mar 2024: Chrome PC and an LG TV.", date: "2024-03-03", count: 3 },
              { kind: "foreign-country", detail: "Someone watched from Brazil on 9 Jun 2024.", date: "2024-06-09", count: 1 },
            ],
          },
        })
      )
    );
    const callout = screen.getByTestId("sharing-callout");
    expect(callout).toHaveTextContent("Someone else might be on your account");
    expect(callout).toHaveTextContent("Two devices played at once on 3 Mar 2024: Chrome PC and an LG TV.");
    expect(callout).toHaveTextContent("Someone watched from Brazil on 9 Jun 2024.");
    expect(callout).toHaveTextContent("Manage access and devices");
    expect(screen.queryByTestId("sharing-clear")).not.toBeInTheDocument();
  });

  it("shows the evidence when nothing looks off, with share-of-time rows", () => {
    renderView(withInsights(timed, insights()));
    expect(screen.getByTestId("sharing-clear")).toHaveTextContent("No signs of a stranger on your account");
    expect(screen.getByTestId("sharing-clear")).toHaveTextContent("2 devices, 1 country, 1 profile.");
    expect(screen.getByText("Synthetic TV")).toBeInTheDocument();
    expect(screen.getByText(/10h · 90%/)).toBeInTheDocument();
  });

  it("locks the account check for a quick export and shows how to get the full file", () => {
    const quick = statsFrom(dateOnlyCsv());
    renderView(withInsights(quick, insights({ devices: null, countries: null, profiles: null, sharing: null })));
    expect(screen.getByTestId("account-locked")).toHaveTextContent("Your quick export keeps this locked");
    expect(screen.getByText("Download your personal information")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add the full file" })).toHaveAttribute("href", "/upload");
  });

  it("still does the money math for stats saved before insights, and asks for the file again", () => {
    const { container } = renderView(withInsights(timed, undefined));
    expect(screen.getByTestId("account-readd")).toHaveTextContent("Re-add your file to see this");
    expect(screen.getByRole("link", { name: "Re-add my file" })).toHaveAttribute("href", "/upload");
    expect(screen.getByTestId("opportunity-total")).toHaveTextContent(formatMoney(hours * 15, "USD", { cents: hours * 15 < 100 }));
    expect(screen.getByLabelText("Months subscribed")).toHaveValue(defaultMonths(withInsights(timed, undefined)));
    // No red buttons: the money hero is the page's one red thing
    expect(primaries(container)).toHaveLength(0);
  });

  it("guesses the currency from the browser's region", () => {
    expect(currencyForLocale("en-GB")).toBe("GBP");
    expect(currencyForLocale("hi-IN")).toBe("INR");
    expect(currencyForLocale("de-DE")).toBe("EUR");
    expect(currencyForLocale("en-SG")).toBe("SGD");
    expect(currencyForLocale("en")).toBe("USD");
  });
});
