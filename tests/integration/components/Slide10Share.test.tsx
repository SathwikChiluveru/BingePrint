// The reel's last slide in each of its modes. fetch, navigator.share, Supabase auth and the canvas
// renderer are mocked; everything else (store, copy, ShareCard) is real.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INVITE_ACTIONS, JOIN_ACTIONS, updateStatsLabel } from "@/lib/copy/invite";
import { PENDING_INVITE_TTL_MS, useAutoplayedStore, type MyGroup, type PendingInvite } from "@/lib/store";
import { emptyStats, statsFrom, timedCsv } from "../fixtures/csv";
import { primaries, renderCalm, stubBrowser } from "./helpers";

const h = vi.hoisted(() => ({
  push: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  user: null as null | { id: string; email?: string },
  /** Set to hold the session read open (auth still resolving) */
  getUser: null as null | (() => Promise<{ data: { user: null | { id: string; email?: string } } }>),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/wrapped/sess1",
  useSearchParams: () => new URLSearchParams(),
}));
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
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: () => (h.getUser ? h.getUser() : Promise.resolve({ data: { user: h.user } })) },
  }),
}));
vi.mock("@/lib/share/renderShareImage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/share/renderShareImage")>();
  return { ...actual, renderShareImage: vi.fn(async () => new Blob(["png"], { type: "image/png" })) };
});

import { Slide10Share } from "@/components/wrapped/slides/Slide10Share";
import { renderShareImage } from "@/lib/share/renderShareImage";

const GROUP: MyGroup = {
  id: "3f0c8a52-6b1e-4c7a-9d2e-1a2b3c4d5e6f",
  inviteCode: "k7mq4xhr2p",
  name: "Couch Club",
  ownedByMe: true,
  sessionId: "sess1",
};
const SHOWN_CODE = "K7MQ4XHR2P";
const stats = statsFrom(timedCsv());

let fetchMock: ReturnType<typeof vi.fn>;
let shareMock: ReturnType<typeof vi.fn>;

function seed({ myGroup = null, pendingInvite = null }: { myGroup?: MyGroup | null; pendingInvite?: PendingInvite | null }) {
  useAutoplayedStore.setState({ wrappedStats: stats, sessionId: "sess1", myGroup, pendingInvite });
}

function respond(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function show(props: Partial<Parameters<typeof Slide10Share>[0]> = {}) {
  return renderCalm(<Slide10Share stats={stats} sessionId="sess1" {...props} />);
}

beforeEach(() => {
  stubBrowser();
  localStorage.clear();
  h.push = vi.fn();
  h.user = { id: "u1", email: "sam@example.test" };
  h.getUser = null;
  fetchMock = vi.fn(async () => respond(200, { members: [] }));
  vi.stubGlobal("fetch", fetchMock);
  shareMock = vi.fn(async () => {});
  Object.defineProperty(navigator, "share", { configurable: true, value: shareMock });
  Object.defineProperty(navigator, "canShare", { configurable: true, value: vi.fn(() => true) });
  URL.createObjectURL = vi.fn(() => "blob:fake");
  URL.revokeObjectURL = vi.fn();
  vi.mocked(renderShareImage).mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("create mode (no group, no invite)", () => {
  it("one red CTA: start my group; no invite code on the card", async () => {
    seed({});
    const { container } = show();
    const cta = await screen.findByRole("button", { name: INVITE_ACTIONS.startGroup });
    expect(primaries(container)).toEqual([cta]);
    expect(screen.getByRole("button", { name: INVITE_ACTIONS.shareCard })).not.toHaveClass("btn-primary");
    expect(screen.getByRole("link", { name: /Join a friend/ })).toHaveAttribute("href", "/groups?mode=join");
    expect(screen.queryByText(SHOWN_CODE)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signed out: the CTA says sign in and goes to login with a return path", async () => {
    h.user = null;
    seed({});
    show();
    const cta = await screen.findByRole("button", { name: "Sign in and start my group" });
    await userEvent.click(cta);
    expect(h.push).toHaveBeenCalledWith(`/auth/login?next=${encodeURIComponent("/wrapped/sess1?autoshare=1")}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starting a group posts a summary only, then the card carries the code", async () => {
    seed({});
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      init?.method === "POST" ? respond(201, { id: GROUP.id, invite_code: GROUP.inviteCode, name: "Couch Club" }) : respond(200, {})
    );
    const { container } = show();
    await userEvent.click(await screen.findByRole("button", { name: INVITE_ACTIONS.startGroup }));

    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST");
    expect(post?.[0]).toBe("/api/groups");
    const body = JSON.parse((post?.[1] as RequestInit).body as string);
    expect(body.share_teaser).toBe(true);
    expect("allBingeSessions" in body.wrapped_data).toBe(false);

    const shareNow = await screen.findByRole("button", { name: "Share it now" });
    expect(primaries(container)).toEqual([shareNow]);
    expect(await screen.findByText(SHOWN_CODE)).toBeInTheDocument();
    expect(useAutoplayedStore.getState().myGroup).toMatchObject({ id: GROUP.id, inviteCode: GROUP.inviteCode, ownedByMe: true });
  });

  it("reads signed out until the session is known, so the label never flips signed-out to signed-in late", async () => {
    let resolveUser: (v: { data: { user: typeof h.user } }) => void = () => {};
    const pending = new Promise<{ data: { user: typeof h.user } }>((r) => (resolveUser = r));
    h.getUser = () => pending;
    seed({});
    show();
    const cta = screen.getByRole("button", { name: "Sign in and start my group" });
    // Focused when the session resolves: the label holds until it loses focus
    act(() => cta.focus());
    await act(async () => resolveUser({ data: { user: h.user } }));
    expect(cta).toHaveTextContent("Sign in and start my group");
    act(() => cta.blur());
    expect(cta).toHaveTextContent(INVITE_ACTIONS.startGroup);
  });

  it("after a create, the group name and nickname show prefilled; Enter renames, card follows", async () => {
    seed({});
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST")
        return respond(201, {
          id: GROUP.id,
          invite_code: GROUP.inviteCode,
          name: "Couch Club",
          members: [{ nickname: "sam" }],
        });
      if (init?.method === "PATCH") return respond(200, { name: "Sofa Kings" });
      return respond(200, {});
    });
    show();
    await userEvent.click(await screen.findByRole("button", { name: INVITE_ACTIONS.startGroup }));
    const shareNow = await screen.findByRole("button", { name: "Share it now" });
    const name = screen.getByLabelText("Group name") as HTMLInputElement;
    const nick = screen.getByLabelText("Your name") as HTMLInputElement;
    expect(name.value).toBe("Couch Club");
    expect(nick.value).toBe("sam");
    expect(screen.getByText("Join Couch Club")).toBeInTheDocument();

    await userEvent.clear(name);
    await userEvent.type(name, "Sofa Kings{Enter}");
    const patch = fetchMock.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === "PATCH");
    expect(patch?.[0]).toBe(`/api/groups/${GROUP.id}`);
    expect(JSON.parse((patch?.[1] as RequestInit).body as string)).toEqual({ name: "Sofa Kings" });
    // Optimistic: the card label, the store and the PNG all carry the new name
    expect(await screen.findByText("Join Sofa Kings")).toBeInTheDocument();
    expect(useAutoplayedStore.getState().myGroup?.name).toBe("Sofa Kings");
    await waitFor(() =>
      expect(renderShareImage).toHaveBeenLastCalledWith(stats, {
        inviteCode: GROUP.inviteCode,
        ownedByMe: true,
        groupName: "Sofa Kings",
      })
    );
    // Sharing was never blocked
    expect(shareNow).not.toHaveAttribute("aria-disabled");
  });

  it("a failed nickname change reverts and says why, inline", async () => {
    seed({});
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST")
        return respond(201, { id: GROUP.id, invite_code: GROUP.inviteCode, name: "Couch Club", members: [{ nickname: "sam" }] });
      if (init?.method === "PUT") return respond(422, {});
      return respond(200, {});
    });
    show();
    await userEvent.click(await screen.findByRole("button", { name: INVITE_ACTIONS.startGroup }));
    await screen.findByRole("button", { name: "Share it now" });
    const nick = screen.getByLabelText("Your name") as HTMLInputElement;
    await userEvent.clear(nick);
    await userEvent.type(nick, "Samwise");
    act(() => nick.blur());
    expect(await screen.findByText("Names are 1 to 30 characters.")).toBeInTheDocument();
    await waitFor(() => expect(nick.value).toBe("sam"));
    expect(screen.getByRole("button", { name: "Share it now" })).toBeInTheDocument();
  });

  it("a 201 carrying a warning is a failure: no code, error shown", async () => {
    seed({});
    fetchMock.mockImplementation(async () =>
      respond(201, { id: GROUP.id, invite_code: GROUP.inviteCode, name: "Couch Club", warning: "stats not added" })
    );
    show();
    await userEvent.click(await screen.findByRole("button", { name: INVITE_ACTIONS.startGroup }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(SHOWN_CODE)).toBeNull();
    expect(useAutoplayedStore.getState().myGroup).toBeNull();
  });
});

describe("stackUp mode (fresh invite)", () => {
  it("one red link to the group; share is secondary; no code", async () => {
    seed({ pendingInvite: { code: "abcd1234ef", groupName: "Film Night", savedAt: Date.now() } });
    const { container } = show();
    const link = await screen.findByRole("link", { name: "See how you stack up in Film Night" });
    expect(link).toHaveAttribute("href", "/groups?join=abcd1234ef");
    expect(primaries(container)).toEqual([link]);
    const share = screen.getByRole("button", { name: INVITE_ACTIONS.shareCard });
    expect(share).toHaveClass("btn-secondary");
    expect(screen.queryByText(/ABCD1234EF/)).toBeNull();
  });

  it("a long group name gives way to 'your group' in the CTA", async () => {
    seed({
      pendingInvite: { code: "abcd1234ef", groupName: "The Extremely Long Film Night Society", savedAt: Date.now() },
    });
    show();
    expect(await screen.findByRole("link", { name: "See how you stack up in your group" })).toBeInTheDocument();
  });

  it("links straight to the group when its id is known", async () => {
    seed({ pendingInvite: { code: "abcd1234ef", groupId: GROUP.id, savedAt: Date.now() } });
    show();
    expect(await screen.findByRole("link", { name: "See how you stack up in your group" })).toHaveAttribute(
      "href",
      `/groups/${GROUP.id}`
    );
  });

  it("signed out with a known group: one link straight to sign-in, back to the group's add form", async () => {
    h.user = null;
    seed({ pendingInvite: { code: "abcd1234ef", groupId: GROUP.id, groupName: "Film Night", savedAt: Date.now() } });
    const { container } = show();
    const link = await screen.findByRole("link", { name: JOIN_ACTIONS.signInToAdd });
    expect(link).toHaveAttribute(
      "href",
      `/auth/login?next=${encodeURIComponent(`/groups/${GROUP.id}?code=abcd1234ef&add=1`)}`
    );
    expect(primaries(container)).toEqual([link]);
    expect(screen.queryByText(/stack up/)).toBeNull();
  });

  it("an expired invite falls back to create mode", async () => {
    seed({ pendingInvite: { code: "abcd1234ef", groupName: "Film Night", savedAt: Date.now() - PENDING_INVITE_TTL_MS - 1 } });
    show();
    expect(await screen.findByRole("button", { name: INVITE_ACTIONS.startGroup })).toBeInTheDocument();
    expect(screen.queryByText(/stack up/)).toBeNull();
  });
});

describe("has-group mode", () => {
  it("checks the group first, then one red share-and-invite with the code", async () => {
    seed({ myGroup: GROUP });
    const { container } = show();
    // While the check runs the code stays off the card, and the card alone can already be shared
    expect(screen.getByRole("button", { name: INVITE_ACTIONS.shareCard })).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByText(SHOWN_CODE)).toBeNull();

    const cta = await screen.findByRole("button", { name: INVITE_ACTIONS.shareCardInvite });
    expect(primaries(container)).toEqual([cta]);
    expect(screen.getByText(SHOWN_CODE)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/groups/${GROUP.id}`);
    expect(screen.getByRole("link", { name: "Open Couch Club" })).toHaveAttribute("href", `/groups/${GROUP.id}`);

    await waitFor(() => expect(renderShareImage).toHaveBeenLastCalledWith(stats, { inviteCode: GROUP.inviteCode, ownedByMe: true, groupName: "Couch Club" })
    );
    await userEvent.click(cta);
    await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(1));
    const data = shareMock.mock.calls[0][0] as ShareData;
    expect(data.text).toContain(SHOWN_CODE);
    expect(data.url).toMatch(/\/groups\?join=k7mq4xhr2p$/);
    expect(data.files).toHaveLength(1);
  });

  it("an unconfirmed group (5xx) shares the card without the code", async () => {
    seed({ myGroup: GROUP });
    fetchMock.mockImplementation(async () => respond(503));
    const { container } = show();
    const cta = await screen.findByRole("button", { name: INVITE_ACTIONS.shareCard });
    expect(primaries(container)).toEqual([cta]);
    expect(screen.queryByText(SHOWN_CODE)).toBeNull();
    expect(useAutoplayedStore.getState().myGroup).not.toBeNull();
  });

  it("a deleted group (404) is forgotten and the slide offers to start one", async () => {
    seed({ myGroup: GROUP });
    fetchMock.mockImplementation(async () => respond(404));
    show();
    expect(await screen.findByRole("button", { name: INVITE_ACTIONS.startGroup })).toBeInTheDocument();
    expect(useAutoplayedStore.getState().myGroup).toBeNull();
  });

  it("a group from an older reel offers Update my stats (secondary), still one red CTA", async () => {
    seed({ myGroup: { ...GROUP, sessionId: "older-reel" } });
    const { container } = show({ sessionId: "sess1" });
    const updateLink = await screen.findByRole("link", { name: updateStatsLabel("Couch Club") });
    expect(updateLink).toHaveAttribute("href", `/groups/${GROUP.id}?update=1`);
    expect(updateLink).toHaveClass("btn-secondary");
    expect(primaries(container)).toHaveLength(1);
    expect(primaries(container)[0]).toHaveTextContent(INVITE_ACTIONS.shareCardInvite);
    // Never a second group from this slide
    expect(screen.queryByRole("button", { name: INVITE_ACTIONS.startGroup })).toBeNull();
  });
});

describe("empty history", () => {
  it("Nothing to share yet, one red upload link, no card render", async () => {
    useAutoplayedStore.setState({ wrappedStats: emptyStats(), sessionId: "sess1", myGroup: null, pendingInvite: null });
    const { container } = renderCalm(<Slide10Share stats={emptyStats()} sessionId="sess1" />);
    expect(screen.getByRole("heading", { name: "Nothing to share yet" })).toBeInTheDocument();
    const upload = screen.getByRole("link", { name: "Upload my history" });
    expect(primaries(container)).toEqual([upload]);
    expect(upload).toHaveAttribute("href", "/upload");
    expect(screen.queryByRole("button", { name: INVITE_ACTIONS.startGroup })).toBeNull();
    await act(async () => {});
    expect(renderShareImage).not.toHaveBeenCalled();
  });
});
