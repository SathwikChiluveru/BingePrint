// The Graveyard slide: hero count, epitaph rows, long titles, and stats stored before insights existed.
import "@testing-library/jest-dom/vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GraveyardShow, Insights, WrappedStats } from "@/types";
import {
  SlideGraveyard,
  deathDate,
  graveyardQuip,
  graveyardSummary,
  hasGraveyard,
} from "@/components/wrapped/slides/SlideGraveyard";
import { renderCalm, stubBrowser } from "./helpers";

function withGraveyard(graveyard: GraveyardShow[], graveyardCount: number): Pick<WrappedStats, "insights"> {
  const insights: Insights = {
    relapses: [],
    graveyard,
    graveyardCount,
    firstWatched: "2020-01-01",
    lastWatched: "2026-01-01",
    monthsSpanned: 73,
    hourHeatmap: null,
    devices: null,
    countries: null,
    profiles: null,
    sharing: null,
  };
  return { insights };
}

const OZARK: GraveyardShow = { title: "Ozark", episodesWatched: 3, firstWatched: "2023-03-01", lastWatched: "2023-03-14" };
const DARK: GraveyardShow = { title: "Dark", episodesWatched: 1, firstWatched: "2022-11-02", lastWatched: "2022-11-02" };
const YOU: GraveyardShow = { title: "You", episodesWatched: 2, firstWatched: "2021-06-01", lastWatched: "2021-06-09" };
const LUPIN: GraveyardShow = { title: "Lupin", episodesWatched: 1, firstWatched: "2021-01-10", lastWatched: "2021-01-10" };
const MINDHUNTER: GraveyardShow = { title: "Mindhunter", episodesWatched: 2, firstWatched: "2020-05-01", lastWatched: "2020-05-03" };

beforeEach(() => stubBrowser());
afterEach(() => cleanup());

describe("SlideGraveyard", () => {
  it("leads with the total buried count, not the capped list length", () => {
    renderCalm(<SlideGraveyard stats={withGraveyard([OZARK, DARK, YOU], 23)} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("23");
    expect(screen.getByText("shows you quit by episode 3")).toBeInTheDocument();
    expect(screen.getByText("and 20 more, never visited")).toBeInTheDocument();
  });

  it("sets each burial as an epitaph row with singular and plural episodes and a death month", () => {
    renderCalm(<SlideGraveyard stats={withGraveyard([OZARK, DARK], 2)} />);
    const rows = within(screen.getByRole("list", { name: "Most recent burials" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Ozark");
    expect(rows[0]).toHaveTextContent("3 episodes");
    expect(rows[0]).toHaveTextContent("Mar 2023");
    expect(rows[1]).toHaveTextContent("1 episode");
    expect(rows[1]).not.toHaveTextContent("1 episodes");
    expect(rows[1].querySelector("time")).toHaveAttribute("dateTime", "2022-11-02");
    // Every row fits the list, so there is no "more" line
    expect(screen.queryByText(/more, never visited/)).toBeNull();
  });

  it("shows at most four rows, and roasts the most recent burial", () => {
    renderCalm(<SlideGraveyard stats={withGraveyard([OZARK, DARK, YOU, LUPIN, MINDHUNTER], 5)} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.queryByText("Mindhunter")).toBeNull();
    expect(screen.getByText("Three episodes was all Ozark got. It had a plan.")).toBeInTheDocument();
  });

  it("keeps a long title whole in its row (CSS clamps it) and shortens it in the roast", () => {
    const long = "The Unbelievably Long and Winding Limited Series About Absolutely Nothing At All";
    renderCalm(
      <SlideGraveyard stats={withGraveyard([{ ...DARK, title: long }], 4)} />
    );
    const row = screen.getByText(long);
    expect(row).toHaveClass("line-clamp-2");
    expect(row).toHaveClass("break-words");
    const quip = screen.getByText(/got one episode/);
    expect(quip.textContent).toContain("…");
    expect(quip.textContent).not.toContain(long);
    expect(quip.textContent!.length).toBeLessThan(90);
  });

  it("uses red only on the hero", () => {
    const { container } = renderCalm(<SlideGraveyard stats={withGraveyard([OZARK, DARK], 2)} />);
    const red = container.querySelectorAll(".text-gradient-red");
    expect(red).toHaveLength(1);
    expect(red[0]).toHaveAttribute("role", "heading");
  });

  it("does not throw on stats stored before insights existed", () => {
    const old = {} as Pick<WrappedStats, "insights">;
    expect(() => renderCalm(<SlideGraveyard stats={old} />)).not.toThrow();
    expect(screen.getByText("Nobody")).toBeInTheDocument();
    expect(hasGraveyard(old)).toBe(false);
    expect(graveyardSummary(old)).toBe("");
  });

  it("does not throw on malformed insights", () => {
    const broken = { insights: { graveyard: null, graveyardCount: "x" } } as unknown as Pick<WrappedStats, "insights">;
    expect(() => renderCalm(<SlideGraveyard stats={broken} />)).not.toThrow();
    expect(hasGraveyard(broken)).toBe(false);
  });
});

describe("graveyard helpers", () => {
  it("summarizes the hero for the live region", () => {
    expect(graveyardSummary(withGraveyard([OZARK], 23))).toBe("23 shows quit by episode 3");
    expect(graveyardSummary(withGraveyard([OZARK], 1))).toBe("1 show quit by episode 3");
    // A count below the list length (stale data) never undercounts what is on screen
    expect(graveyardSummary(withGraveyard([OZARK, DARK], 0))).toBe("2 shows quit by episode 3");
  });

  it("gates on having at least one burial", () => {
    expect(hasGraveyard(withGraveyard([OZARK], 1))).toBe(true);
    expect(hasGraveyard(withGraveyard([], 0))).toBe(false);
  });

  it("formats the death month without timezone drift", () => {
    expect(deathDate("2023-01-01")).toBe("Jan 2023");
    expect(deathDate("2023-12-31")).toBe("Dec 2023");
    expect(deathDate("nope")).toBeNull();
  });

  it("varies the roast by episodes watched and by a lone grave", () => {
    expect(graveyardQuip(DARK, 5)).toBe("Dark got one episode. That was the audition, and it failed.");
    expect(graveyardQuip(YOU, 5)).toBe("Two episodes was all You got. Not even a cliffhanger saved it.");
    expect(graveyardQuip(OZARK, 1)).toBe("Just one grave. Ozark made it 3 episodes, then nothing.");
    expect(graveyardQuip(DARK, 1)).toBe("Just one grave. Dark got a single episode and your silence.");
  });
});
