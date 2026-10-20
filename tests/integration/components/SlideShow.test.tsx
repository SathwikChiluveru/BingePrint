// The swipeable reel: slide order, keyboard paging, the night-owl gate, resume, and the empty path.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoplayedStore } from "@/lib/store";
import type { WrappedStats } from "@/types";
import { dateOnlyCsv, emptyStats, statsFrom, timedCsv } from "../fixtures/csv";
import { renderCalm, stubBrowser } from "./helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/wrapped/sess1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock("@/lib/share/renderShareImage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/share/renderShareImage")>();
  return { ...actual, renderShareImage: vi.fn(async () => new Blob(["png"], { type: "image/png" })) };
});

import { SlideShow } from "@/components/wrapped/SlideShow";

const SESSION = "sess1";

function show(stats: WrappedStats) {
  useAutoplayedStore.setState({ wrappedStats: stats, sessionId: SESSION, myGroup: null, pendingInvite: null });
  return renderCalm(<SlideShow stats={stats} sessionId={SESSION} />);
}

/** Slide titles in order, read from the dot buttons. */
function dotTitles() {
  return screen
    .getAllByRole("button", { name: /^Go to / })
    .map((b) => (b.getAttribute("aria-label") ?? "").replace(/^Go to (.*), slide \d+ of \d+$/, "$1"));
}

function live() {
  // The reel's own announcer (Slide10Share has its own aria-live status line inside the slide)
  return document.querySelector('section[aria-roledescription="carousel"] > p[aria-live]')?.textContent ?? "";
}

async function press(key: string) {
  await act(async () => {
    fireEvent.keyDown(window, { key });
  });
}

beforeEach(() => {
  stubBrowser();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

afterEach(() => cleanup());

describe("SlideShow", () => {
  it("renders the timed reel with the night-owl slide", () => {
    show(statsFrom(timedCsv()));
    const titles = dotTitles();
    expect(titles[0]).toBe("Intro");
    expect(titles).toContain("Night owl");
    expect(titles.slice(-2)).toEqual(["Personality", "Your card"]);
    expect(live()).toBe(`Intro, slide 1 of ${titles.length}`);
  });

  it("ArrowRight advances and ArrowLeft goes back, and the position is saved", async () => {
    show(statsFrom(timedCsv()));
    const n = dotTitles().length;
    await press("ArrowRight");
    // The announcement carries the slide's hero, not just its name
    expect(live()).toMatch(new RegExp(`^Total watched: [\\d,]+ hours?, slide 2 of ${n}$`));
    expect(sessionStorage.getItem(`autoplayed:slide:${SESSION}`)).toBe("1");
    await press("ArrowLeft");
    expect(live()).toBe(`Intro, slide 1 of ${n}`);
    // Never before the first slide
    await press("ArrowLeft");
    expect(live()).toBe(`Intro, slide 1 of ${n}`);
  });

  it("skips the night-owl slide for a date-only export", () => {
    show(statsFrom(dateOnlyCsv()));
    expect(dotTitles()).not.toContain("Night owl");
  });

  it("skips the night-owl slide when hasTimeData is missing (older stats)", () => {
    const legacy = { ...statsFrom(timedCsv()) } as Partial<WrappedStats>;
    delete legacy.hasTimeData;
    show(legacy as WrappedStats);
    expect(dotTitles()).not.toContain("Night owl");
  });

  it("resumes from sessionStorage, clamped to the last slide", () => {
    sessionStorage.setItem(`autoplayed:slide:${SESSION}`, "2");
    const { unmount } = show(statsFrom(timedCsv()));
    expect(live()).toMatch(/^Top show: .+, slide 3 of \d+$/);
    unmount();

    sessionStorage.setItem(`autoplayed:slide:${SESSION}`, "99");
    show(statsFrom(timedCsv()));
    expect(live()).toMatch(/^Your card, slide (\d+) of \1$/);
  });

  it("a reel already watched to its card offers Skip to my card on the intro", async () => {
    localStorage.clear();
    const first = show(statsFrom(timedCsv()));
    expect(screen.queryByRole("button", { name: "Skip to my card" })).toBeNull();
    first.unmount();

    localStorage.setItem(`autoplayed:viewed:${SESSION}`, "1");
    sessionStorage.removeItem(`autoplayed:slide:${SESSION}`);
    show(statsFrom(timedCsv()));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Skip to my card" }));
    });
    expect(live()).toMatch(/^Your card, slide (\d+) of \1$/);
    localStorage.clear();
  });

  it("a fresh invite is named on the intro", () => {
    const stats = statsFrom(timedCsv());
    useAutoplayedStore.setState({
      wrappedStats: stats,
      sessionId: SESSION,
      myGroup: null,
      pendingInvite: { code: "abcd1234ef", groupName: "Film Night", savedAt: Date.now() },
    });
    renderCalm(<SlideShow stats={stats} sessionId={SESSION} />);
    expect(screen.getByText("Film Night is waiting at the end.")).toBeInTheDocument();
  });

  it("an invitee can skip straight to their group (the card), even on a first watch", async () => {
    localStorage.clear();
    const stats = statsFrom(timedCsv());
    useAutoplayedStore.setState({
      wrappedStats: stats,
      sessionId: SESSION,
      myGroup: null,
      pendingInvite: { code: "abcd1234ef", groupName: "Film Night", savedAt: Date.now() },
    });
    renderCalm(<SlideShow stats={stats} sessionId={SESSION} />);
    expect(screen.queryByRole("button", { name: "Skip to my card" })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Skip to Film Night" }));
    });
    expect(live()).toMatch(/^Your card, slide (\d+) of \1$/);
  });

  it("an invite without a group name skips to 'your group'", () => {
    const stats = statsFrom(timedCsv());
    useAutoplayedStore.setState({
      wrappedStats: stats,
      sessionId: SESSION,
      myGroup: null,
      pendingInvite: { code: "abcd1234ef", savedAt: Date.now() },
    });
    renderCalm(<SlideShow stats={stats} sessionId={SESSION} />);
    expect(screen.getByRole("button", { name: "Skip to your group" })).toBeInTheDocument();
  });

  it("the last slide has a Home link beside Back, since the X is hidden there on phones", () => {
    sessionStorage.setItem(`autoplayed:slide:${SESSION}`, "99");
    show(statsFrom(timedCsv()));
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getAllByRole("button", { name: "Previous slide" }).length).toBeGreaterThan(0);
  });

  it("slide 4 with 5 or fewer different titles leads with the count, not 100%", () => {
    const stats = statsFrom(dateOnlyCsv());
    expect(stats.uniqueShowsCount).toBeLessThanOrEqual(5);
    sessionStorage.setItem(`autoplayed:slide:${SESSION}`, "3");
    show(stats);
    const phrase = stats.uniqueShowsCount === 1 ? "1 show or movie" : `${stats.uniqueShowsCount} different shows and movies`;
    expect(live()).toBe(`Top five: ${phrase}, slide 4 of ${dotTitles().length}`);
    expect(screen.queryByText("%")).toBeNull();
    expect(screen.getByText("Not much of a contest.")).toBeInTheDocument();
  });

  it("ignores a garbage stored slide", () => {
    sessionStorage.setItem(`autoplayed:slide:${SESSION}`, "-3");
    show(statsFrom(timedCsv()));
    expect(live()).toMatch(/^Intro, slide 1 of/);
  });

  it("an empty history is just intro then the empty card", async () => {
    show(emptyStats());
    expect(dotTitles()).toEqual(["Intro", "Your card"]);
    await press("ArrowRight");
    expect(live()).toBe("Your card, slide 2 of 2");
    expect(await screen.findByRole("heading", { name: "Nothing to share yet" })).toBeInTheDocument();
    // No dots on the last slide
    expect(screen.queryByRole("navigation", { name: "Slides" })).toBeNull();
  });
});
