import { describe, expect, it } from "vitest";
import {
  GROUP_NAME_BUTTON_MAX,
  INVITE_ACTIONS,
  JOIN_ACTIONS,
  NETFLIX_FILE_STEPS,
  addReelToLabel,
  createGroupErrorMessage,
  groupNameForButton,
  inviteShareMessage,
  inviteShareText,
  inviteShareTitle,
  inviteUrl,
  inviterKicker,
  leaveGroupConfirmLine,
  leaveGroupErrorMessage,
  leaveGroupLabel,
  nicknameErrorMessage,
  renameGroupErrorMessage,
  teaserFormDisclosure,
  updateStatsLabel,
  uploadWithInviteHref,
} from "@/lib/copy/invite";

describe("invite copy: action names", () => {
  it("uses exactly these action strings", () => {
    expect(INVITE_ACTIONS).toEqual({
      startGroup: "Start my group and invite",
      shareCardInvite: "Share my card and invite",
      shareCard: "Share my card",
      shareInvite: "Share the invite",
    });
    expect(JOIN_ACTIONS).toEqual({
      makeReel: "Make my reel",
      signInToAdd: "Sign in to add my reel",
      addReel: "Add my reel",
    });
  });

  it("never names a join action 'Prove it'", () => {
    for (const v of [...Object.values(INVITE_ACTIONS), ...Object.values(JOIN_ACTIONS)]) {
      expect(v).not.toMatch(/prove it/i);
    }
  });

  it("all action names are unique", () => {
    const all = [...Object.values(INVITE_ACTIONS), ...Object.values(JOIN_ACTIONS)];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("groupNameForButton", () => {
  it("keeps names up to the limit, trimmed", () => {
    expect(groupNameForButton("  The Couch Crew  ")).toBe("The Couch Crew");
    const exact = "x".repeat(GROUP_NAME_BUTTON_MAX);
    expect(groupNameForButton(exact)).toBe(exact);
  });

  it("falls back for long, blank or missing names", () => {
    expect(groupNameForButton("x".repeat(GROUP_NAME_BUTTON_MAX + 1))).toBe("your group");
    expect(groupNameForButton("   ")).toBe("your group");
    expect(groupNameForButton(null)).toBe("your group");
    expect(groupNameForButton(undefined, "the group")).toBe("the group");
  });

  it("feeds the update/add labels", () => {
    expect(updateStatsLabel("Crew")).toBe("Update my stats in Crew");
    expect(addReelToLabel("x".repeat(40))).toBe("Add my reel to your group");
  });
});

describe("invite links and share text", () => {
  it("builds lowercase, encoded invite URLs", () => {
    expect(inviteUrl(" ABCD1234 ", "https://autoplayed.app")).toBe("https://autoplayed.app/groups?join=abcd1234");
    expect(uploadWithInviteHref("ABCD1234")).toBe("/upload?join=abcd1234");
    expect(inviteUrl("a&b=c", "https://x.test")).toBe("https://x.test/groups?join=a%26b%3Dc");
  });

  it("share text always carries the uppercase code", () => {
    const plain = inviteShareText({ code: "abcd1234", groupName: "Crew" });
    expect(plain).toContain("ABCD1234");
    expect(plain).toContain("Crew");
    expect(plain).not.toContain("abcd1234");
  });

  it("weaves the sharer's personality in mid-sentence", () => {
    const text = inviteShareText({ code: "abcd1234", groupName: "Crew", personality: "The Binge Lord" });
    expect(text).toContain("Autoplayed says I'm the Binge Lord.");
    expect(text).toContain("code ABCD1234");
    expect(inviteShareText({ code: "abcd1234", groupName: "Crew", personality: "   " })).toMatch(/^Somebody in Crew/);
  });

  it("share message appends the link (explicit or derived)", () => {
    const msg = inviteShareMessage({ code: "abcd1234", groupName: "Crew", url: "https://x.test/groups?join=abcd1234" });
    expect(msg.endsWith(" https://x.test/groups?join=abcd1234")).toBe(true);
    expect(msg).toContain("ABCD1234");
  });

  it("share title names the group", () => {
    expect(inviteShareTitle("Crew")).toBe("Join Crew on Autoplayed");
  });

  it("no invite copy uses em dashes", () => {
    const strings = [
      inviteShareText({ code: "abcd1234", groupName: "Crew" }),
      inviteShareText({ code: "abcd1234", groupName: "Crew", personality: "The Night Owl" }),
      teaserFormDisclosure("The Night Owl", true),
      ...NETFLIX_FILE_STEPS,
      ...[400, 401, 413, 422, 429, 500].map(createGroupErrorMessage),
    ];
    for (const s of strings) expect(s).not.toMatch(/—/);
  });
});

describe("teaserFormDisclosure", () => {
  it("leads with titles unless hasTimeData is exactly true", () => {
    expect(teaserFormDisclosure("The Loyalist", true)).toContain("your total hours");
    expect(teaserFormDisclosure("The Loyalist", false)).toContain("how many titles you've watched");
    expect(teaserFormDisclosure("The Loyalist", undefined)).toContain("how many titles you've watched");
    expect(teaserFormDisclosure("The Loyalist", true)).toContain("“The Loyalist”");
  });
});

describe("createGroupErrorMessage", () => {
  it.each([
    [422, /Upload your file again/],
    [413, /too big/],
    [429, /Wait 10 minutes/],
    [400, /Reload the page/],
    [500, /Check your connection/],
    [0, /Check your connection/],
  ])("status %i", (status, pattern) => {
    expect(createGroupErrorMessage(status)).toMatch(pattern);
  });

  it("never says 'in a moment' for errors that won't fix themselves", () => {
    for (const s of [400, 413, 422, 429]) expect(createGroupErrorMessage(s)).not.toMatch(/in a moment/i);
  });
});

describe("invite copy: group entry points and sign-in lines", () => {
  it("names the entry points and never uses '&'", async () => {
    const { GROUP_ACTIONS } = await import("@/lib/copy/invite");
    expect(GROUP_ACTIONS.startMyGroup).toBe("Start my group");
    expect(GROUP_ACTIONS.signInAndStart).toBe("Sign in and start my group");
    for (const v of Object.values(GROUP_ACTIONS)) expect(v).not.toContain("&");
  });

  it("starts the sign-in line from the personality when a reel exists", async () => {
    const { signInToStartLine } = await import("@/lib/copy/invite");
    expect(signInToStartLine("The Casual Viewer")).toBe("Sign in to start The Casual Viewer's group.");
    expect(signInToStartLine(null)).toBe("Sign in to start your group.");
  });

  it("counts new members since the last visit", async () => {
    const { newSinceLastVisitLine } = await import("@/lib/copy/invite");
    expect(newSinceLastVisitLine(2)).toBe("New since your last visit: 2 joined.");
  });
});

describe("invite copy: teaser names the inviter", () => {
  it("kicker uses the nickname, else \"Your friend is\"", () => {
    expect(inviterKicker("Sam")).toBe("Sam is");
    expect(inviterKicker("  ")).toBe("Your friend is");
    expect(inviterKicker(null)).toBe("Your friend is");
  });

  it("disclosures say friends see your name", () => {
    expect(teaserFormDisclosure("The Loyalist", true)).toMatch(/your name/);
  });
});

describe("invite copy: rename, nickname and leave", () => {
  it("shortens long group names in the leave label", () => {
    expect(leaveGroupLabel("Crew")).toBe("Leave Crew");
    expect(leaveGroupLabel("x".repeat(40))).toBe("Leave this group");
  });

  it("tells owners the group stays theirs", () => {
    expect(leaveGroupConfirmLine(true)).toMatch(/stays yours/);
    expect(leaveGroupConfirmLine(false)).toMatch(/invite code again/);
  });

  it("every status gets owned copy, never \"try again in a moment\" for client errors", () => {
    for (const fn of [renameGroupErrorMessage, nicknameErrorMessage, leaveGroupErrorMessage]) {
      for (const status of [0, 401, 404, 422, 429, 500]) {
        const m = fn(status);
        expect(m.length).toBeGreaterThan(10);
        expect(m).not.toMatch(/in a moment/);
      }
    }
    expect(renameGroupErrorMessage(403)).toMatch(/Only the person/);
  });
});
