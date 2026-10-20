/**
 * One source for invite wording: action names, share text, teaser disclosure and the "get your
 * Netflix file" steps. Used by the groups pages, compare, InviteActions and the reel's last slide,
 * so the same action never goes by two names.
 */

/** The invite action names. Exactly these strings, everywhere. */
export const INVITE_ACTIONS = {
  /** No group yet: creates one and opens sharing */
  startGroup: "Start my group and invite",
  /** Has a confirmed group: the card carries its code */
  shareCardInvite: "Share my card and invite",
  /** No invite attached: no group, an unconfirmed group, or the quiet option */
  shareCard: "Share my card",
  /** Group page and compare: shares the link and code (the card rides along when ready) */
  shareInvite: "Share the invite",
} as const;

export type InviteActionName = (typeof INVITE_ACTIONS)[keyof typeof INVITE_ACTIONS];

/**
 * What an invitee's button does, named by outcome. One name per outcome, never "Prove it" (that
 * stays a headline line): no reel yet, reel but signed out, signed in with a reel.
 */
export const JOIN_ACTIONS = {
  makeReel: "Make my reel",
  signInToAdd: "Sign in to add my reel",
  addReel: "Add my reel",
} as const;

/**
 * Group entry points and sign-in variants. Signed-out labels always spell out "and", never "&",
 * so screen readers and share previews read them the same way.
 */
export const GROUP_ACTIONS = {
  /** /groups choose screen: opens the create form */
  startMyGroup: "Start my group",
  /** /groups choose screen: opens the code form */
  joinWithCode: "Join with a code",
  /** Signed-out version of startGroup (the reel's last slide) */
  signInAndStart: "Sign in and start my group",
} as const;

/** "Sign in to start {personality}'s group", or a plain line when no reel is on this device. */
export function signInToStartLine(personality: string | null | undefined): string {
  const p = (personality ?? "").trim();
  return p ? `Sign in to start ${p}'s group.` : "Sign in to start your group.";
}

/** Group names run to 60 characters; past this, buttons say "your group" instead. */
export const GROUP_NAME_BUTTON_MAX = 24;

/** The group's name when it fits in a button label, otherwise `fallback` ("your group"). */
export function groupNameForButton(name: string | null | undefined, fallback = "your group"): string {
  const trimmed = (name ?? "").trim();
  return trimmed && trimmed.length <= GROUP_NAME_BUTTON_MAX ? trimmed : fallback;
}

/** "Update my stats in {group}", shortened for long names. Shared by the group page and the reel. */
export function updateStatsLabel(groupName: string | null | undefined): string {
  return `Update my stats in ${groupNameForButton(groupName)}`;
}

/** "Add my reel to {group}", shortened for long names. */
export function addReelToLabel(groupName: string | null | undefined): string {
  return `Add my reel to ${groupNameForButton(groupName)}`;
}

/** Error for a typed code that fails isValidInviteCode (8 to 10 letters and numbers). */
export const INVITE_CODE_FORMAT_ERROR =
  "Invite codes are 8 to 10 characters, letters and numbers only. Check the code with whoever sent it.";

/** One-tap create on the reel's last slide (teaser is on by default there). */
export const TEASER_DISCLOSURE =
  "Starts a group with your stats, never your file. Friends with the code see your name and personality.";

/** Label and disclosure for the teaser checkbox on the /groups create form (pre-checked). */
export const TEASER_CHECKBOX_LABEL = "Show my name and personality on the invite page";

export function teaserFormDisclosure(personality: string, hasTimeData: boolean | undefined): string {
  // Only an explicit true means real watch times; anything else leads with the exact title count
  const stat = hasTimeData !== true ? "how many titles you've watched" : "your total hours";
  return `Anyone with your code sees your name, “${personality}” and ${stat}, even before they sign in. On by default; untick to keep it hidden.`;
}

/** Group page line for members who joined since this device last opened the group. */
export function newSinceLastVisitLine(count: number): string {
  return `New since your last visit: ${count} joined.`;
}

/** Absolute invite link. Codes are lowercase in URLs; joining accepts any case. */
export function inviteUrl(code: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/groups?join=${encodeURIComponent(code.trim().toLowerCase())}`;
}

/** Where an invitee without a reel goes: upload, with the code carried in the URL. */
export function uploadWithInviteHref(code: string): string {
  return `/upload?join=${encodeURIComponent(code.trim().toLowerCase())}`;
}

export function inviteShareTitle(groupName: string): string {
  return `Join ${groupName} on Autoplayed`;
}

interface ShareTextInput {
  code: string;
  groupName: string;
  /** The sharer's personality, when their reel is on this device */
  personality?: string | null;
}

/** "The Binge Lord" reads as "the Binge Lord" mid-sentence. */
function midSentence(personality: string) {
  return personality.replace(/^The\s+/, "the ");
}

/**
 * Share text in the roast voice. Always carries the code (uppercase) so it still works when the
 * target app drops the link. The link goes separately (navigator.share's `url`) or via
 * inviteShareMessage() for the clipboard.
 */
export function inviteShareText({ code, groupName, personality }: ShareTextInput): string {
  const shown = code.trim().toUpperCase();
  if (personality && personality.trim()) {
    return `Autoplayed says I'm ${midSentence(personality.trim())}. Think you watch less Netflix than me? Prove it: join ${groupName} with code ${shown}.`;
  }
  return `Somebody in ${groupName} watches way too much Netflix. Prove it's not you: join on Autoplayed with code ${shown}.`;
}

/** Share text plus the link, for the clipboard and for targets that ignore `url`. */
export function inviteShareMessage(input: ShareTextInput & { url?: string }): string {
  const url = input.url ?? inviteUrl(input.code);
  return `${inviteShareText(input)} ${url}`;
}

/** Shown in in-app browsers (Instagram, WhatsApp...), which can't hand over the Netflix file. */
export const IN_APP_OPEN_LINE = "Open this link in Safari or Chrome to grab your Netflix file.";

/** The three steps to the quick export (NetflixViewingHistory.csv). */
export const NETFLIX_FILE_STEPS = [
  "In a browser (not the Netflix app), go to netflix.com/viewingactivity and pick your profile.",
  "Scroll to the bottom and tap “Download all”.",
  "Come back here and drop in NetflixViewingHistory.csv. It never leaves your browser.",
] as const;

/**
 * Create-group errors by status. 401 is handled by the caller (it needs a sign-in link).
 * Never "try again in a moment" for errors that won't fix themselves.
 */
export function createGroupErrorMessage(status: number): string {
  if (status === 422) return "Your stats couldn't be read. Upload your file again.";
  if (status === 413) {
    return "Your stats came out too big to send. Upload your file again; if it keeps happening, use the quick export from Viewing activity.";
  }
  if (status === 429) return "You've started a lot of groups in the last few minutes. Wait 10 minutes, then try again.";
  if (status === 400) return "That request got garbled on the way. Reload the page and try again.";
  return "Couldn't create the group. Check your connection and try again.";
}

/**
 * A 2xx create that still isn't usable: the server warned (group made, stats not added), or the
 * body has no id or code. Same rule as the reel's last slide.
 */
export const CREATE_GROUP_INCOMPLETE_MESSAGE =
  "The group didn't finish setting up. Try again; if it keeps happening, reload the page.";

/**
 * Owner rename (PATCH /api/groups/[id]) errors by status. 0 = the request never reached us.
 */
export function renameGroupErrorMessage(status: number): string {
  if (status === 0) return "Couldn't reach Autoplayed. Check your connection and try again.";
  if (status === 401) return "Your sign-in expired. Sign in again, then rename the group.";
  if (status === 403) return "Only the person who started the group can rename it.";
  if (status === 404) return "This group no longer exists, or you're not in it.";
  if (status === 422) return "Group names are 1 to 60 characters.";
  if (status === 429) return "That's a lot of renames. Wait a few minutes, then try again.";
  return "Couldn't rename the group. The old name is still there. Try again.";
}

/** Nickname edit (PUT /api/groups/[id]/members/me with { nickname }) errors by status. */
export function nicknameErrorMessage(status: number): string {
  if (status === 0) return "Couldn't reach Autoplayed. Check your connection and try again.";
  if (status === 401) return "Your sign-in expired. Sign in again, then change your name.";
  if (status === 404) return "You're not in this group anymore. Refresh the page.";
  if (status === 422) return "Names are 1 to 30 characters.";
  if (status === 429) return "Too many changes. Wait a minute, then try again.";
  return "Couldn't change your name. The old one is still there. Try again.";
}

/** Leave (DELETE /api/groups/[id]/members/me) errors by status. */
export function leaveGroupErrorMessage(status: number): string {
  if (status === 0) return "Couldn't reach Autoplayed. Check your connection and try again.";
  if (status === 401) return "Your sign-in expired. Sign in again, then leave the group.";
  if (status === 404) return "You're not in this group anymore. Refresh the page.";
  if (status === 429) return "Too many tries. Wait a minute, then try again.";
  return "Couldn't leave the group. You're still in it. Try again.";
}

/** "Leave {group}", shortened for long names. */
export function leaveGroupLabel(groupName: string | null | undefined): string {
  return `Leave ${groupNameForButton(groupName, "this group")}`;
}

/**
 * Inline confirm under "Leave {group}". Owners keep the group (it stays theirs, the code still
 * works), so they get their own line.
 */
export function leaveGroupConfirmLine(ownedByMe: boolean): string {
  return ownedByMe
    ? "Your name and stats come off the board. The group stays yours and the invite code keeps working; you can add your reel again later."
    : "Your name and stats come off the board. To come back you'll need the invite code again.";
}

/** Invite kicker: "Sam is" with the owner's nickname, else "Your friend is". */
export function inviterKicker(nickname: string | null | undefined): string {
  const name = (nickname ?? "").trim();
  return name ? `${name} is` : "Your friend is";
}
