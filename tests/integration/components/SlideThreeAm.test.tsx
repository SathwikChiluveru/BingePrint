// The 3am Report: hero pick, peak roast, text equivalent, and the locked teaser for date-only files.
import "@testing-library/jest-dom/vitest";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SlideThreeAm, threeAmSummary } from "@/components/wrapped/slides/SlideThreeAm";
import type { HourHeatmap, Insights, WrappedStats } from "@/types";
import { renderCalm, stubBrowser } from "./helpers";

type Stats = Pick<WrappedStats, "insights" | "hasTimeData">;

function grid(fill: (day: number, hour: number) => number) {
  return Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => fill(d, h)));
}

function withHeatmap(hourHeatmap: HourHeatmap | null, hasTimeData = true): Stats {
  const insights: Insights = {
    relapses: [],
    graveyard: [],
    graveyardCount: 0,
    firstWatched: "2024-01-01",
    lastWatched: "2024-06-01",
    monthsSpanned: 6,
    hourHeatmap,
    devices: null,
    countries: null,
    profiles: null,
    sharing: null,
  };
  return { hasTimeData, insights };
}

/** Saturday 1am is the busiest cell; evenings are steady. */
function lateHeatmap(over: Partial<HourHeatmap> = {}): HourHeatmap {
  return {
    cells: grid((d, h) => (d === 5 && h === 1 ? 600 : h >= 19 && h <= 22 ? 120 : h === 3 ? 30 : 0)),
    peakDay: "Sat",
    peakHour: 1,
    lateNightShare: 18,
    threeAmMinutes: 210,
    ...over,
  };
}

beforeEach(() => stubBrowser());
afterEach(() => cleanup());

describe("SlideThreeAm with time data", () => {
  it("leads with the late-night share and roasts the peak cell", () => {
    renderCalm(<SlideThreeAm stats={withHeatmap(lateHeatmap())} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("18%");
    expect(screen.getByText("of your watching starts between midnight and 5am")).toBeInTheDocument();
    expect(
      screen.getByText("Your peak is Saturday at 1am. Saturday at 1am is not a time, it's a confession."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/dates, not times/)).not.toBeInTheDocument();
  });

  it("switches to 3am hours when they outshine a modest share", () => {
    const stats = withHeatmap(lateHeatmap({ lateNightShare: 9, threeAmMinutes: 41 * 60 + 10 }));
    renderCalm(<SlideThreeAm stats={stats} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("41h");
    expect(screen.getByText("spent in the 3am hour, all-time")).toBeInTheDocument();
    expect(threeAmSummary(stats)).toBe("41 hours in the 3am hour");
  });

  it("keeps a big share as the hero even with many 3am hours", () => {
    const stats = withHeatmap(lateHeatmap({ lateNightShare: 34.4, threeAmMinutes: 5000 }));
    expect(threeAmSummary(stats)).toBe("34% of your watching starts between midnight and 5am");
  });

  it("never rounds a sliver of late nights up or down to a lie", () => {
    const stats = withHeatmap(lateHeatmap({ lateNightShare: 0.3, threeAmMinutes: 5 }));
    renderCalm(<SlideThreeAm stats={stats} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("under 1%");
    expect(threeAmSummary(stats)).toMatch(/^under 1%/);
  });

  it("gives screen readers the peak, the share and the three busiest cells", () => {
    renderCalm(<SlideThreeAm stats={withHeatmap(lateHeatmap())} />);
    expect(screen.getByText(/Busiest hour: Saturdays at 1am\. 18% of your watching/)).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toHaveLength(3);
    expect(items[0]).toBe("Saturday at 1am: 10 hours");
    expect(items[1]).toBe("Monday at 7pm: 2 hours");
  });

  it("hides the visual grid from assistive tech and draws 168 cells", () => {
    const { container } = renderCalm(<SlideThreeAm stats={withHeatmap(lateHeatmap())} />);
    const gridEl = container.querySelector('[aria-hidden="true"].grid');
    expect(gridEl).not.toBeNull();
    expect(gridEl!.querySelectorAll("span.aspect-square")).toHaveLength(168);
    expect(gridEl).toHaveTextContent("3am");
    expect(gridEl).toHaveTextContent("12pm");
  });

  it("falls back to the grid's own peak when the stored one is invalid", () => {
    const stats = withHeatmap(lateHeatmap({ peakHour: 99 }));
    renderCalm(<SlideThreeAm stats={stats} />);
    expect(screen.getByText(/^Your peak is Saturday at 1am\./)).toBeInTheDocument();
  });
});

describe("SlideThreeAm locked", () => {
  it("shows the sample teaser and the full-export steps for a date-only file", () => {
    const stats = withHeatmap(null, false);
    const { container } = renderCalm(<SlideThreeAm stats={stats} />);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Your file has dates, not times. The 3am Report needs the full data request.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Download your personal information")).toBeInTheDocument();
    expect(screen.getByText("CONTENT_INTERACTION/ViewingActivity.csv")).toBeInTheDocument();
    const sample = screen.getByText("Sample");
    expect(sample.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelector(".text-gradient-red")).toBeNull();
    expect(threeAmSummary(stats)).toBe("locked, needs the full data request");
  });

  it("renders the locked state when insights are missing entirely", () => {
    expect(() => renderCalm(<SlideThreeAm stats={{ hasTimeData: true }} />)).not.toThrow();
    expect(screen.getByText(/dates, not times/)).toBeInTheDocument();
    expect(threeAmSummary({ hasTimeData: true })).toBe("locked, needs the full data request");
  });

  it("treats a heatmap on a not-explicitly-timed reel as locked", () => {
    renderCalm(<SlideThreeAm stats={withHeatmap(lateHeatmap(), false)} />);
    expect(screen.getByText(/dates, not times/)).toBeInTheDocument();
  });
});
