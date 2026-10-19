// File-to-reel flow through ReelDropZone (shares useReelUpload with /upload). The CSV is parsed
// for real; only the router is mocked.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoplayedStore } from "@/lib/store";
import { dateOnlyCsv, emptyCsv, timedCsv } from "../fixtures/csv";
import { renderCalm, stubBrowser } from "./helpers";

const h = vi.hoisted(() => ({ push: null as unknown as ReturnType<typeof import("vitest").vi.fn> }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReelDropZone } from "@/components/landing/ReelDropZone";

function fileInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input");
  return input;
}

function csvFile(text: string, name: string, type = "text/csv") {
  return new File([text], name, { type });
}

async function pick(container: HTMLElement, file: File) {
  // applyAccept off: the hook itself must reject wrong files, not the browser's accept filter
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(fileInput(container), file);
}

beforeEach(() => {
  stubBrowser();
  localStorage.clear();
  useAutoplayedStore.setState({ wrappedStats: null, sessionId: null, pendingInvite: null, myGroup: null });
  h.push = vi.fn();
  window.history.replaceState(null, "", "/");
});

afterEach(() => cleanup());

describe("upload flow (ReelDropZone + useReelUpload)", () => {
  it("rejects a non-CSV with copy that never says upload", async () => {
    const { container } = renderCalm(<ReelDropZone />);
    await pick(container, csvFile("hello", "notes.txt", "text/plain"));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That's not a CSV.");
    expect(alert.textContent ?? "").not.toMatch(/upload/i);
    expect(h.push).not.toHaveBeenCalled();
  });

  it("rejects the data-request zip with an unzip hint", async () => {
    const { container } = renderCalm(<ReelDropZone />);
    await pick(container, new File(["PK"], "netflix-report.zip", { type: "application/zip" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/zip/i);
    expect(alert.textContent ?? "").not.toMatch(/upload/i);
  });

  it("rejects a CSV with the wrong columns", async () => {
    const { container } = renderCalm(<ReelDropZone />);
    await pick(container, csvFile("Name,Amount\nCoffee,3", "budget.csv"));
    expect(await screen.findByRole("alert")).toHaveTextContent("That CSV isn't a Netflix viewing history.");
    expect(h.push).not.toHaveBeenCalled();
  });

  it("rejects a header-only file as empty", async () => {
    const { container } = renderCalm(<ReelDropZone />);
    await pick(container, csvFile(emptyCsv(), "NetflixViewingHistory.csv"));
    expect(await screen.findByRole("alert")).toHaveTextContent("That file has no watch history in it.");
  });

  it("accepts an uppercase .CSV and opens the reel", async () => {
    const { container } = renderCalm(<ReelDropZone />);
    await pick(container, csvFile(dateOnlyCsv(), "NETFLIXVIEWINGHISTORY.CSV", ""));
    await waitFor(() => expect(h.push).toHaveBeenCalledTimes(1));
    const target = h.push.mock.calls[0][0] as string;
    expect(target).toMatch(/^\/wrapped\/[a-z0-9]{1,8}$/);
    const { sessionId, wrappedStats } = useAutoplayedStore.getState();
    expect(target).toBe(`/wrapped/${sessionId}`);
    expect(wrappedStats?.hasTimeData).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a timed CSV stores stats with time data", async () => {
    const { container } = renderCalm(<ReelDropZone />);
    await pick(container, csvFile(timedCsv(), "ViewingActivity.csv"));
    await waitFor(() => expect(h.push).toHaveBeenCalled());
    expect(useAutoplayedStore.getState().wrappedStats?.hasTimeData).toBe(true);
  });

  it("carries ?join=CODE into the reel URL and adopts the invite", async () => {
    window.history.replaceState(null, "", "/upload?join=ABCD-1234-EF");
    const { container } = renderCalm(<ReelDropZone />);
    await waitFor(() => expect(useAutoplayedStore.getState().pendingInvite?.code).toBe("abcd1234ef"));
    await pick(container, csvFile(dateOnlyCsv(), "NetflixViewingHistory.csv"));
    await waitFor(() => expect(h.push).toHaveBeenCalledTimes(1));
    expect(h.push.mock.calls[0][0]).toMatch(/^\/wrapped\/[a-z0-9]{1,8}\?join=abcd1234ef$/);
  });

  it("ignores a malformed join code", async () => {
    window.history.replaceState(null, "", "/upload?join=<script>");
    const { container } = renderCalm(<ReelDropZone />);
    await pick(container, csvFile(dateOnlyCsv(), "NetflixViewingHistory.csv"));
    await waitFor(() => expect(h.push).toHaveBeenCalledTimes(1));
    expect(h.push.mock.calls[0][0]).not.toContain("join");
    expect(useAutoplayedStore.getState().pendingInvite).toBeNull();
  });

  it("a drop uses the first file and the same validation", async () => {
    const { container } = renderCalm(<ReelDropZone />);
    const zone = container.querySelector("[data-reel-dropzone]") as HTMLElement;
    const files = [csvFile(dateOnlyCsv(), "NetflixViewingHistory.csv"), csvFile("x", "other.csv")];
    fireEvent.drop(zone, { dataTransfer: { files, types: ["Files"] } });
    await waitFor(() => expect(h.push).toHaveBeenCalledTimes(1));
  });
});
