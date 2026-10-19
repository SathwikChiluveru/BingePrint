import type { GroupMember, Personality, WrappedStats } from "@/types";
import { memberHasTime, memberTitles, memberTitlesInflated } from "@/components/groups/memberStats";

/**
 * Pure comparison logic for /groups/[groupId]/compare.
 * Rule: if any member's export has dates only, everyone is ranked by titles (exact for everyone);
 * hours are only compared when every member has real watch times. Values are never mixed.
 * "Titles" means unique title+day pairs (distinctTitleDays) so a timed export, which logs one row
 * per sitting, is not inflated next to a date-only one; older stats fall back to their row count.
 */

export type Metric = "titles" | "hours";

export interface RankedMember {
  member: GroupMember;
  rank: number;
  value: number; // in the chosen metric, rounded
  isMe: boolean;
  share: number; // 0..1 of the leader's value, for the bar
  roast: string;
}

export interface Superlative {
  key: "loyal" | "day" | "owl";
  label: string;
  name: string;
  isMe: boolean;
  detail: string; // may contain "~" for estimated values
}

export interface Comparison {
  metric: Metric;
  ranked: RankedMember[];
  leader: RankedMember;
  me: RankedMember | null;
  headline: string;
  punchline: string;
  dateOnlyNames: string[];
  /** Everyone's export is date-only, so no names are needed in the metric note */
  allDateOnly: boolean;
  /** Members whose title count comes from older timed stats and may include repeat sittings */
  inflatedNames: string[];
  /** Leader's margin over second place (0 on a tie) */
  gap: number;
  runnerUp: RankedMember | null;
  superlatives: Superlative[];
  nightOwlNote: string | null;
}

type Data = WrappedStats;

function titlesOf(d: Data) {
  return memberTitles(d);
}

function hoursOf(d: Data) {
  return Math.max(0, Math.round(d.totalHours ?? 0));
}

export function unitLabel(metric: Metric, n: number) {
  if (metric === "titles") return n === 1 ? "title" : "titles";
  return n === 1 ? "hour" : "hours";
}

function count(metric: Metric, n: number) {
  return `${n.toLocaleString()} ${unitLabel(metric, n)}`;
}

// Biggest day in the member's own terms: titles for date-only exports, hours for timed ones
function biggestDayTitles(d: Data) {
  const b = d.longestBinge;
  if (!b) return 0;
  return b.titleCount ?? b.titles?.length ?? b.showCount ?? 0;
}

function biggestDayHours(d: Data) {
  return (d.longestBinge?.totalSeconds ?? 0) / 3600;
}

function shortDate(value: unknown) {
  if (!value) return null;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatHoursOneDp(h: number) {
  const rounded = h >= 10 ? Math.round(h) : Math.round(h * 10) / 10;
  return `${rounded.toLocaleString()}h`;
}

const PERSONALITY_JAB: Record<Personality, string> = {
  "The Binge Lord": "Crowned the Binge Lord. Not a compliment.",
  "The Night Owl": "The Night Owl. Sleep is a rumor.",
  "The Weekend Warrior": "The Weekend Warrior. Saturdays never stood a chance.",
  "The Loyalist": "The Loyalist. Same show, forever.",
  "The Genre Surfer": "The Genre Surfer. Commits to nothing.",
  "The Casual Viewer": "The Casual Viewer. Suspiciously well adjusted.",
};

/** One roast line per member: personality jab, top show, biggest day. Shared with the group page. */
export function memberRoast(d: Data): string {
  const parts: string[] = [];
  parts.push(PERSONALITY_JAB[d.personality] ?? `${d.personality}.`);

  const top = d.topShows?.[0];
  if (top && top.watchCount > 0) {
    parts.push(`Pressed play on ${top.title} ${top.watchCount.toLocaleString()} ${top.watchCount === 1 ? "time" : "times"}.`);
  }

  const when = shortDate(d.longestBinge?.startTime);
  if (memberHasTime(d)) {
    const h = biggestDayHours(d);
    if (h > 0) parts.push(`Sat through ${formatHoursOneDp(h)} straight${when ? ` on ${when}` : ""}.`);
  } else {
    const t = biggestDayTitles(d);
    if (t > 0) parts.push(`${t.toLocaleString()} ${t === 1 ? "title" : "titles"} in one day${when ? ` on ${when}` : ""}.`);
  }
  return parts.join(" ");
}

function headToHead(metric: Metric, ranked: RankedMember[], me: RankedMember | null) {
  const leader = ranked[0];
  const second = ranked[1];
  const leaderName = leader.member.nickname;

  if (me && me.rank === 1) {
    const tiedWith = ranked.filter((r) => r !== me && r.value === me.value);
    if (tiedWith.length > 0) {
      return {
        headline: `You and ${tiedWith[0].member.nickname} are dead even at ${count(metric, me.value)}.`,
        punchline: "Equally guilty. Nobody gets the crown.",
      };
    }
    const lead = me.value - (second?.value ?? 0);
    return {
      headline: "You out-watched everyone.",
      punchline: `By ${count(metric, lead)}. Nobody is proud of you.`,
    };
  }

  if (me) {
    const gap = leader.value - me.value;
    let punchline: string;
    if (me.value === 0) punchline = "You logged nothing. Either you have a life or you uploaded the wrong file.";
    else if (gap <= Math.max(1, leader.value * 0.05)) punchline = "That close. One rainy weekend and the crown is yours.";
    else if (leader.value / me.value >= 3) punchline = `That is ${Math.floor(leader.value / me.value)}x more than you. Someone check on ${leaderName}.`;
    else punchline = `You still watched ${count(metric, me.value)}. Losing here is not the flex you think.`;
    return {
      headline: `${leaderName} out-watched you by ${count(metric, gap)}.`,
      punchline,
    };
  }

  // Viewer is not on the board (for example the owner never added their own stats)
  const lead = leader.value - (second?.value ?? 0);
  return {
    headline: !second
      ? `${leaderName} is the only one on the board.`
      : lead === 0
        ? `${leaderName} and ${second.member.nickname} are dead even.`
        : `${leaderName} out-watched everyone by ${count(metric, lead)}.`,
    punchline: "Your reel isn't on the board yet. Add it and get roasted too.",
  };
}

function pickMax<T>(items: T[], score: (t: T) => number): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const item of items) {
    const s = score(item);
    if (s > bestScore) {
      best = item;
      bestScore = s;
    }
  }
  return best && bestScore > 0 ? best : null;
}

/**
 * Ranks members by the fair metric (titles if anyone is date-only, else hours). Ties share a rank.
 * Works for any count, including zero or one member; the group page uses it for its member rows.
 */
export function rankMembers(members: GroupMember[], myUserId: string | null): { metric: Metric; ranked: RankedMember[] } {
  const metric: Metric = members.some((m) => !memberHasTime(m.wrapped_data)) ? "titles" : "hours";
  const valueOf = (d: Data) => (metric === "titles" ? titlesOf(d) : hoursOf(d));

  const sorted = [...members].sort(
    (a, b) => valueOf(b.wrapped_data) - valueOf(a.wrapped_data) || a.nickname.localeCompare(b.nickname)
  );
  const top = Math.max(1, sorted[0] ? valueOf(sorted[0].wrapped_data) : 0);

  // Competition ranking: ties share a rank (1, 1, 3)
  const ranked: RankedMember[] = [];
  sorted.forEach((member, i) => {
    const value = valueOf(member.wrapped_data);
    const prev = ranked[i - 1];
    ranked.push({
      member,
      rank: prev && prev.value === value ? prev.rank : i + 1,
      value,
      isMe: !!myUserId && member.user_id === myUserId,
      share: value / top,
      roast: memberRoast(member.wrapped_data),
    });
  });
  return { metric, ranked };
}

/** Needs at least one member; the compare page only calls it with two or more. */
export function buildComparison(members: GroupMember[], myUserId: string | null): Comparison {
  const { metric, ranked } = rankMembers(members, myUserId);
  const me = ranked.find((r) => r.isMe) ?? null;
  const { headline, punchline } = headToHead(metric, ranked, me);
  const isMe = (m: GroupMember) => !!myUserId && m.user_id === myUserId;

  const superlatives: Superlative[] = [];

  const loyal = pickMax(members, (m) => m.wrapped_data.topShows?.[0]?.watchCount ?? 0);
  if (loyal) {
    const show = loyal.wrapped_data.topShows[0];
    superlatives.push({
      key: "loyal",
      label: "Most loyal",
      name: loyal.nickname,
      isMe: isMe(loyal),
      detail: `${show.title}, ${show.watchCount.toLocaleString()} ${show.watchCount === 1 ? "time" : "times"}`,
    });
  }

  if (metric === "titles") {
    const day = pickMax(members, (m) => biggestDayTitles(m.wrapped_data));
    if (day) {
      const t = biggestDayTitles(day.wrapped_data);
      const when = shortDate(day.wrapped_data.longestBinge?.startTime);
      superlatives.push({
        key: "day",
        label: "Biggest single day",
        name: day.nickname,
        isMe: isMe(day),
        detail: `${t.toLocaleString()} ${t === 1 ? "title" : "titles"}${when ? ` on ${when}` : ""}`,
      });
    }
  } else {
    const day = pickMax(members, (m) => biggestDayHours(m.wrapped_data));
    if (day) {
      const when = shortDate(day.wrapped_data.longestBinge?.startTime);
      superlatives.push({
        key: "day",
        label: "Longest binge",
        name: day.nickname,
        isMe: isMe(day),
        detail: `${formatHoursOneDp(biggestDayHours(day.wrapped_data))} straight${when ? ` on ${when}` : ""}`,
      });
    }
  }

  const timed = members.filter((m) => memberHasTime(m.wrapped_data));
  const dateOnly = members.filter((m) => !memberHasTime(m.wrapped_data));
  const dateOnlyNames = dateOnly.map((m) => m.nickname);
  let nightOwlNote: string | null = null;
  if (timed.length >= 2) {
    const owl = pickMax(timed, (m) => m.wrapped_data.nightOwlScore ?? 0);
    if (owl) {
      superlatives.push({
        key: "owl",
        label: "Night owl",
        name: owl.nickname,
        isMe: isMe(owl),
        // Same window as the reel's Night owl slide
        detail: `${owl.wrapped_data.nightOwlScore}% of viewing starts between 10pm and 4am`,
      });
    }
    if (dateOnly.length > 0) nightOwlNote = `Night owl leaves out ${listNames(dateOnlyNames)}: no watch times in that export.`;
  } else if (dateOnly.length > 0) {
    nightOwlNote = "Night owl needs two people whose exports include watch times.";
  }

  const inflatedNames =
    metric === "titles" ? members.filter((m) => memberTitlesInflated(m.wrapped_data)).map((m) => m.nickname) : [];

  return {
    metric,
    ranked,
    leader: ranked[0],
    me,
    headline,
    punchline,
    dateOnlyNames,
    allDateOnly: dateOnly.length === members.length,
    inflatedNames,
    gap: ranked[0].value - (ranked[1]?.value ?? 0),
    runnerUp: ranked[1] ?? null,
    superlatives,
    nightOwlNote,
  };
}

export function listNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * Punchline for the shared head-to-head card. The on-page punchline talks to the viewer ("you");
 * the card is read by people outside the group, so it names names instead.
 */
export function cardPunchline(c: Comparison): string {
  const leader = c.leader.member.nickname;
  const second = c.runnerUp;
  if (!second) return `${leader} has nobody to lose to yet.`;
  if (c.gap === 0) return "Equally guilty. Nobody gets the crown.";
  if (second.value === 0) return `${second.member.nickname} logged nothing. ${leader} watched enough for both.`;
  const ratio = c.leader.value / second.value;
  if (ratio >= 3) return `${Math.floor(ratio)}x more than ${second.member.nickname}. Someone check on ${leader}.`;
  if (c.gap <= Math.max(1, c.leader.value * 0.05)) return "One rainy weekend could flip this.";
  return `${second.member.nickname} came second. Still not a flex.`;
}
