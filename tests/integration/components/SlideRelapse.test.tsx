// The relapse tracker slide: hero sentence, movie variant, runner-ups, and stats without insights.
import "@testing-library/jest-dom/vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SlideRelapse, hasRelapses, relapseSummary } from "@/components/wrapped/slides/SlideRelapse";
import type { Insights, RelapseShow } from "@/types";
import { renderCalm, stubBrowser } from "./helpers";

const FRIENDS: RelapseShow = {
  title: "Friends",
  kind: "show",
  restarts: 10,
  rewatchedEpisodes: 140,
  timeline: [
    "2019-01-05",
    "2019-06-10",
    "2019-12-01",
    "2020-04-02",
    "2020-11-11",
    "2021-03-03",
    "2021-09-09",
    "2022-02-14",
    "2023-01-01",
    "2024-05-05",
    "2025-03-17",
  ],
};

const GLASS_ONION: RelapseShow = {
  title: "Glass Onion",
  kind: "movie",
  restarts: 4,
  rewatchedEpisodes: 0,
  timeline: ["2023-01-02", "2023-04-08", "2023-08-20", "2024-12-25"],
};

const OFFICE: RelapseShow = {
  title: "The Office",
  kind: "show",
  restarts: 3,
  rewatchedEpisodes: 12,
  timeline: ["2020-02-01", "2021-02-01", "2022-02-01", "2023-02-01"],
};

const BAKE_OFF: RelapseShow = {
  title: "The Great British Bake Off",
  kind: "show",
  restarts: 2,
  rewatchedEpisodes: 4,
  timeline: ["2021-05-01", "2022-05-01", "2023-05-01"],
};

function withRelapses(relapses: RelapseShow[]) {
  return { insights: { relapses } as unknown as Insights };
}

beforeEach(() => stubBrowser());
afterEach(() => cleanup());

describe("SlideRelapse", () => {
  it("leads with the worst offender's restart count as the heading", () => {
    // Out of order on purpose: the slide picks the biggest relapse, not the first row
    const { container } = renderCalm(<SlideRelapse stats={withRelapses([OFFICE, FRIENDS])} />);
    const hero = screen.getByRole("heading", { level: 2 });
    expect(hero).toHaveTextContent("10");
    expect(hero).toHaveAccessibleName("You've restarted Friends 10 times");
    expect(hero).toHaveClass("slide-hero", "text-gradient-red");
    expect(screen.getByTestId("relapse-label")).toHaveTextContent("times you've started Friends over");
    expect(screen.getByText("At this point it's not a rewatch. It's a support group.")).toBeInTheDocument();
    // Only the hero carries the red gradient
    expect(container.querySelectorAll(".text-gradient-red")).toHaveLength(1);
  });

  it("draws the log with Day 0 and the span, plus a screen-reader list", () => {
    renderCalm(<SlideRelapse stats={withRelapses([FRIENDS])} />);
    expect(screen.getByText("Day 0")).toBeInTheDocument();
    // 2019-01-05 to 2025-03-17
    expect(screen.getByText("Day 2,263")).toBeInTheDocument();
    expect(screen.getByText("2019")).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();

    const log = screen.getByRole("list", { name: "Friends relapse log" });
    const items = within(log).getAllByRole("listitem");
    expect(items).toHaveLength(11);
    expect(items[0]).toHaveTextContent(/^First watch: /);
    expect(items[10]).toHaveTextContent(/^Restart 10: /);
  });

  it("uses the movie variant", () => {
    renderCalm(<SlideRelapse stats={withRelapses([GLASS_ONION])} />);
    const hero = screen.getByRole("heading", { level: 2 });
    expect(hero).toHaveTextContent("4");
    expect(hero).toHaveAccessibleName("You've watched Glass Onion 4 times");
    expect(screen.getByTestId("relapse-label")).toHaveTextContent("times you've watched Glass Onion");
    expect(screen.getByText("It ends the same way. You checked anyway.")).toBeInTheDocument();
    const items = within(screen.getByRole("list", { name: "Glass Onion relapse log" })).getAllByRole("listitem");
    expect(items[3]).toHaveTextContent(/^Watch 4: /);
  });

  it("lists at most two runner-ups, one line each", () => {
    renderCalm(<SlideRelapse stats={withRelapses([FRIENDS, GLASS_ONION, OFFICE, BAKE_OFF])} />);
    const list = screen.getByRole("list", { name: "Also relapsing" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Glass Onion watched 4 times");
    expect(rows[1]).toHaveTextContent("The Office restarted 3 times");
    expect(screen.queryByText("The Great British Bake Off")).not.toBeInTheDocument();
  });

  it("says time, not times, for a single relapse", () => {
    const once: RelapseShow = { ...OFFICE, restarts: 1, timeline: ["2020-02-01", "2020-02-20"] };
    renderCalm(<SlideRelapse stats={withRelapses([once])} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveAccessibleName("You've restarted The Office 1 time");
    // Inside one year, the ends carry month and year
    const feb = new Date(Date.UTC(2020, 1, 1)).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    expect(screen.getAllByText(feb)).toHaveLength(2);
    expect(screen.queryByText("2020")).not.toBeInTheDocument();
  });

  it("does not throw when insights are missing", () => {
    expect(() => renderCalm(<SlideRelapse stats={{}} />)).not.toThrow();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(hasRelapses({})).toBe(false);
    expect(hasRelapses(withRelapses([]))).toBe(false);
    expect(relapseSummary({})).toBe("Relapse: nothing to report");
  });

  it("summarizes the worst offender for the live region", () => {
    expect(hasRelapses(withRelapses([FRIENDS]))).toBe(true);
    expect(relapseSummary(withRelapses([OFFICE, FRIENDS]))).toBe("Relapse: Friends restarted 10 times");
    expect(relapseSummary(withRelapses([GLASS_ONION]))).toBe("Relapse: Glass Onion watched 4 times");
  });
});
