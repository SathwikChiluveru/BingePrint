import type { WrappedStats } from "@/types";
import { safeInviteCode } from "./safety";
import { EMPTY_HISTORY_LINE, isLikelyMovie, upgradeStoredStats } from "@/lib/csv/stats";
import { groupNameForButton } from "@/lib/copy/invite";

export type ShareImageStats = Pick<
  WrappedStats,
  | "personality"
  | "personalityDescription"
  | "totalHours"
  | "hasTimeData"
  | "topShows"
  | "totalEpisodesEstimate"
>;

export interface ShareImageOptions {
  /** When set, the card carries a "Join {group}" block with this invite code (see inviteLabel). */
  inviteCode?: string;
  /** The viewer created the group: label reads "Join my group", else "Join our group". */
  ownedByMe?: boolean;
  /** The group's name: the label reads "Join {name}" when it fits (see inviteLabel). */
  groupName?: string | null;
}

const WIDTH = 1080;
const HEIGHT = 1920;
const PAD_X = 96;
const CONTENT_W = WIDTH - PAD_X * 2;

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const MONO_STACK = 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace';

const COLOR_BG = "#141414";
// Seat Row Raised (--color-surface-2): the invite code chip
const COLOR_SURFACE_2 = "#242424";
const COLOR_TEXT = "#ffffff";
const COLOR_SECONDARY = "#b3b3b3";
const COLOR_MUTED = "#8c8c8c";
const COLOR_BORDER = "rgba(255, 255, 255, 0.12)";
// Same stops as .text-gradient-red
const COLOR_RED = "#e50914";
const COLOR_CORAL = "#ff6b6b";

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

/**
 * The Autoplayed mark: a play triangle with rounded corners, drawn (never a glyph) so it renders the
 * same everywhere. Points are in a unit box, shared by the PNG and the on-screen SVG (ShareCard).
 * The mark is width PLAY_MARK_ASPECT x height 1; corners round via a stroke of PLAY_MARK_STROKE.
 */
export const PLAY_MARK_ASPECT = 0.88;
export const PLAY_MARK_STROKE = 0.16;
export const PLAY_MARK_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0.08, 0.08],
  [0.8, 0.5],
  [0.08, 0.92],
];

/** Draws the play mark with its top-left corner at (x, y), `size` px tall. */
function drawPlayMark(ctx: Ctx, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.beginPath();
  PLAY_MARK_POINTS.forEach(([px, py], i) => {
    const X = x + px * size;
    const Y = y + py * size;
    if (i === 0) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineWidth = size * PLAY_MARK_STROKE;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function font(weight: number, size: number, stack = FONT_STACK): string {
  return `${weight} ${size}px ${stack}`;
}

/** Sets tracking where the browser supports ctx.letterSpacing; returns whether it applied. */
function setTracking(ctx: Ctx, px: number): boolean {
  if ("letterSpacing" in ctx) {
    ctx.letterSpacing = `${px}px`;
    return true;
  }
  return false;
}

/** Draws centered text with tracking, falling back to per-character spacing. */
function drawTracked(ctx: Ctx, text: string, x: number, y: number, trackingPx: number) {
  if (setTracking(ctx, trackingPx)) {
    // Native letterSpacing adds trailing space after the last glyph; offset half of it.
    ctx.textAlign = "center";
    ctx.fillText(text, x + trackingPx / 2, y);
    setTracking(ctx, 0);
    return;
  }
  const chars = Array.from(text);
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + trackingPx * (chars.length - 1);
  let cursor = x - total / 2;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cursor, y);
    cursor += widths[i] + trackingPx;
  });
  ctx.textAlign = "center";
}

function drawLabel(ctx: Ctx, text: string, x: number, y: number) {
  ctx.font = font(600, 30);
  ctx.fillStyle = COLOR_MUTED;
  drawTracked(ctx, text.toUpperCase(), x, y, 3);
}

/** Greedy word wrap; words longer than maxWidth are broken by character. */
function wrapLines(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const pushWord = (word: string) => {
    if (ctx.measureText(word).width <= maxWidth) return word;
    let chunk = "";
    for (const ch of Array.from(word)) {
      if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    return chunk;
  };
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = pushWord(word);
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Wraps into the same number of lines greedy wrapping needs, but at the narrowest width that
 * still allows it, so lines come out similar in length instead of leaving a one-word orphan.
 */
function balancedLines(ctx: Ctx, text: string, maxWidth: number): string[] {
  const greedy = wrapLines(ctx, text, maxWidth);
  if (greedy.length <= 1) return greedy;
  const widestWord = Math.max(
    ...text.trim().split(/\s+/).map((w) => ctx.measureText(w).width)
  );
  let lo = Math.min(widestWord, maxWidth);
  let hi = maxWidth;
  let best = greedy;
  for (let i = 0; i < 14 && hi - lo > 1; i++) {
    const mid = (lo + hi) / 2;
    const lines = wrapLines(ctx, text, mid);
    if (lines.length <= greedy.length) {
      best = lines;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}

/** Wraps to at most maxLines, ellipsizing the last line when text overflows. */
function clampLines(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  const lines = wrapLines(ctx, text, maxWidth);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
    last = last.slice(0, -1);
  }
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

function num(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** The one headline total: exact titles watched when durations are estimated, else hours. */
export function pickShareTotal(stats: ShareImageStats): { value: string; label: string } {
  // Only an explicit true means real durations; older stats without the flag read as date-only,
  // the same rule SlideShow uses for the night-owl slide.
  if (stats.hasTimeData !== true) {
    const titles = num(stats.totalEpisodesEstimate);
    return { value: titles.toLocaleString(), label: titles === 1 ? "title watched" : "titles watched" };
  }
  const hours = num(stats.totalHours);
  return { value: hours.toLocaleString(), label: hours === 1 ? "hour watched" : "hours watched" };
}

/**
 * Top-show punchline, e.g. "341 episodes of Stranger Things", "Watched 3 times: Inception" or
 * "Watched once: Inception"; null when there is no top show.
 */
export function pickTopShowLine(stats: ShareImageStats): string | null {
  const top = stats.topShows?.[0];
  const title = top?.title?.trim();
  if (!title) return null;
  const count = num(top?.watchCount);
  if (count <= 0) return title;
  // One play reads as a movie or a sampled pilot, never "1 episode of Inception".
  if (count === 1) return `Watched once: ${title}`;
  // A rewatched movie has no episodes.
  if (isLikelyMovie(top)) return `Watched ${count.toLocaleString()} times: ${title}`;
  return `${count.toLocaleString()} episodes of ${title}`;
}

/**
 * Invite label: "Join {group name}" when the name fits a button label (24 characters), otherwise
 * "Join my group" ("my" only when the viewer created it) or "Join our group".
 */
export function inviteLabel(ownedByMe: boolean | undefined, groupName?: string | null): string {
  const name = groupNameForButton(groupName, "");
  if (name) return `Join ${name}`;
  return ownedByMe ? "Join my group" : "Join our group";
}

export function shareRoastLine(stats: ShareImageStats): string {
  // An empty history (including stats stored before the empty-state copy) gets the empty line.
  if (num(stats.totalEpisodesEstimate) <= 0 && num(stats.totalHours) <= 0) return EMPTY_HISTORY_LINE;
  // Stats saved by an older build may carry a Casual Viewer line that repeats the total.
  return upgradeStoredStats(stats).personalityDescription?.trim() ?? "";
}

function siteHost(): string {
  try {
    return window.location.host || "autoplayed";
  } catch {
    return "autoplayed";
  }
}

interface HeroLayout {
  size: number;
  lines: string[];
}

/**
 * Largest hero size whose balanced wrap fits in 3 lines without a short orphan line
 * (shortest line at least 60% of the longest). Falls back to the first size that fits.
 */
function layoutHero(ctx: Ctx, text: string, maxSize: number, minSize: number): HeroLayout {
  let fallback: HeroLayout | null = null;
  for (let size = maxSize; size >= minSize; size -= 4) {
    ctx.font = font(900, size);
    setTracking(ctx, -size * 0.03);
    const lines = balancedLines(ctx, text, CONTENT_W);
    if (lines.length > 3) continue;
    const widths = lines.map((l) => ctx.measureText(l).width);
    const ratio = Math.min(...widths) / Math.max(...widths);
    if (lines.length === 1 || ratio >= 0.6) return { size, lines };
    fallback ??= { size, lines };
  }
  if (fallback) return fallback;
  ctx.font = font(900, minSize);
  setTracking(ctx, -minSize * 0.03);
  return { size: minSize, lines: clampLines(ctx, text, CONTENT_W, 3) };
}

/** Renders a 1080x1920 (9:16) PNG summary of the user's wrapped stats. Client-only. */
export async function renderShareImage(
  stats: ShareImageStats,
  opts: ShareImageOptions = {}
): Promise<Blob> {
  // System fonts only, so there is nothing to wait for before drawing.
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d") as Ctx | null;
  if (!ctx) throw new Error("Canvas is not supported in this browser.");

  const cx = WIDTH / 2;
  const host = siteHost();
  // Only a well-formed code is drawn, so the printed join link is always a real one.
  const inviteCode = safeInviteCode(opts.inviteCode)?.toUpperCase() ?? "";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ----- Measure the bottom zone (invite block or host line + disclaimer) -----
  const disclaimerY = HEIGHT - 104;
  const INVITE_H = 360;
  const inviteTop = disclaimerY - 72 - INVITE_H;
  const bottomZoneTop = inviteCode ? inviteTop : disclaimerY - 56 - 34;

  // ----- Measure the content block so it can be centered in the free space -----
  const personality = upgradeStoredStats(stats).personality?.trim() || "The Casual Viewer";
  const roast = shareRoastLine(stats);
  const topShowLine = pickTopShowLine(stats);
  const total = pickShareTotal(stats);

  const WORDMARK_Y = 200;
  const zoneTop = WORDMARK_Y + 96;
  const zoneBottom = bottomZoneTop - 96;
  const available = zoneBottom - zoneTop;

  const ROAST_SIZE = 46;
  const ROAST_LH = 64;
  ctx.font = font(400, ROAST_SIZE);
  const roastLines = roast ? clampLines(ctx, roast, CONTENT_W, 3) : [];

  const SHOW_SIZE = 56;
  const SHOW_LH = 68;
  ctx.font = font(700, SHOW_SIZE);
  const showLines = topShowLine ? clampLines(ctx, topShowLine, CONTENT_W, 2) : [];

  const TOTAL_SIZE = 120;
  const GAP_HERO_ROAST = 56;
  const GAP_SECTION = 72; // above and below the divider
  const GAP_SHOW_TOTAL = 64;

  const restH =
    (roastLines.length ? GAP_HERO_ROAST + roastLines.length * ROAST_LH : 0) +
    GAP_SECTION * 2 +
    2 +
    (showLines.length ? showLines.length * SHOW_LH + GAP_SHOW_TOTAL : 0) +
    TOTAL_SIZE * 0.8 +
    56; // total label

  // Hero: shrink the ceiling until the whole block fits the free space.
  let hero = layoutHero(ctx, personality, 168, 88);
  for (let max = hero.size - 8; hero.lines.length * hero.size * 0.98 + restH > available && max >= 88; max -= 8) {
    hero = layoutHero(ctx, personality, max, Math.min(88, max));
  }
  const heroLineH = hero.size * 0.98;
  const heroBlockH = hero.lines.length * heroLineH;
  const blockH = heroBlockH + restH;
  const blockTop = zoneTop + Math.max(0, (available - blockH) / 2);

  // One glow source, centered behind the personality hero
  const glowY = blockTop + heroBlockH / 2;
  const glow = ctx.createRadialGradient(cx, glowY, 0, cx, glowY, WIDTH * 0.75);
  glow.addColorStop(0, "rgba(229, 9, 20, 0.15)");
  glow.addColorStop(1, "rgba(229, 9, 20, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Wordmark: the red play mark, then the word, centered as one unit. Red here because the PNG
  // carries no CTA; the on-screen card draws the same mark white (One Red Thing Rule).
  ctx.font = font(900, 64);
  setTracking(ctx, -1);
  const wordW = ctx.measureText("Autoplayed").width;
  const markH = 48; // about the cap height of 64px black weight
  const markW = markH * PLAY_MARK_ASPECT;
  const markGap = 16;
  const markLeft = cx - (markW + markGap + wordW) / 2;
  drawPlayMark(ctx, markLeft, WORDMARK_Y - markH, markH, COLOR_RED);
  ctx.fillStyle = COLOR_TEXT;
  ctx.fillText("Autoplayed", cx + (markW + markGap) / 2, WORDMARK_Y);
  setTracking(ctx, 0);

  // Personality hero in the reel's red gradient (Reel Red to coral, 135deg). The PNG is the frame
  // that travels and carries no CTA, so it is exempt from the One Red Thing Rule; the on-screen
  // card keeps this hero white so slide 10's CTA stays the only red there.
  ctx.font = font(900, hero.size);
  setTracking(ctx, -hero.size * 0.03);
  const heroW = Math.max(...hero.lines.map((l) => ctx.measureText(l).width), 1);
  const heroX0 = cx - heroW / 2;
  // 135deg in CSS runs top-left to bottom-right; span the hero block's own box.
  const heroGradient = ctx.createLinearGradient(heroX0, blockTop, heroX0 + heroW, blockTop + heroBlockH);
  heroGradient.addColorStop(0, COLOR_RED);
  heroGradient.addColorStop(1, COLOR_CORAL);
  ctx.fillStyle = heroGradient;
  hero.lines.forEach((line, i) => {
    ctx.fillText(line, cx, blockTop + hero.size * 0.82 + i * heroLineH);
  });
  setTracking(ctx, 0);

  let y = blockTop + heroBlockH;

  // Roast line
  if (roastLines.length) {
    y += GAP_HERO_ROAST;
    ctx.font = font(400, ROAST_SIZE);
    ctx.fillStyle = COLOR_SECONDARY;
    roastLines.forEach((line, i) => {
      ctx.fillText(line, cx, y + ROAST_SIZE * 0.9 + i * ROAST_LH);
    });
    y += roastLines.length * ROAST_LH;
  }

  // Divider
  y += GAP_SECTION;
  ctx.fillStyle = COLOR_BORDER;
  ctx.fillRect(PAD_X + CONTENT_W * 0.3, y, CONTENT_W * 0.4, 2);
  y += 2 + GAP_SECTION;

  // Top-show punchline
  if (showLines.length) {
    ctx.font = font(700, SHOW_SIZE);
    ctx.fillStyle = COLOR_TEXT;
    showLines.forEach((line, i) => {
      ctx.fillText(line, cx, y + SHOW_SIZE * 0.85 + i * SHOW_LH);
    });
    y += showLines.length * SHOW_LH + GAP_SHOW_TOTAL;
  }

  // The one total
  let totalSize = TOTAL_SIZE;
  ctx.font = font(900, totalSize);
  setTracking(ctx, -3);
  while (ctx.measureText(total.value).width > CONTENT_W && totalSize > 56) {
    totalSize -= 4;
    ctx.font = font(900, totalSize);
  }
  ctx.fillStyle = COLOR_TEXT;
  ctx.fillText(total.value, cx, y + TOTAL_SIZE * 0.8);
  setTracking(ctx, 0);
  drawLabel(ctx, total.label, cx, y + TOTAL_SIZE * 0.8 + 56);

  // ----- Bottom zone -----
  if (inviteCode) {
    // Label, then the code as one mono chip (DESIGN.md "Displayed codes": 6px radius on screen,
    // Seat Row Raised, 1px Hairline, 0.2em tracking; scaled here), then the join link.
    ctx.font = font(600, 30);
    const label = clampLines(ctx, inviteLabel(opts.ownedByMe, opts.groupName).toUpperCase(), CONTENT_W - 64, 1)[0];
    drawLabel(ctx, label, cx, inviteTop + 84);

    const CHIP_PAD_X = 56;
    let codeSize = 104;
    const codeTracking = () => codeSize * 0.2;
    const codeWidth = () => {
      ctx.font = font(600, codeSize, MONO_STACK);
      // Without native tracking, drawTracked spaces the characters itself: measure the same way.
      const native = setTracking(ctx, codeTracking());
      const w = native
        ? ctx.measureText(inviteCode).width - codeTracking()
        : ctx.measureText(inviteCode).width + codeTracking() * (inviteCode.length - 1);
      setTracking(ctx, 0);
      return w;
    };
    let textW = codeWidth();
    while (textW + CHIP_PAD_X * 2 > CONTENT_W && codeSize > 56) {
      codeSize -= 4;
      textW = codeWidth();
    }
    const chipH = Math.round(codeSize * 1.45);
    const chipW = textW + CHIP_PAD_X * 2;
    const chipTop = inviteTop + 128;
    ctx.fillStyle = COLOR_SURFACE_2;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(cx - chipW / 2, chipTop, chipW, chipH, 18);
    else ctx.rect(cx - chipW / 2, chipTop, chipW, chipH);
    ctx.fill();
    ctx.strokeStyle = COLOR_BORDER;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = font(600, codeSize, MONO_STACK);
    ctx.fillStyle = COLOR_TEXT;
    drawTracked(ctx, inviteCode, cx, chipTop + chipH / 2 + codeSize * 0.36, codeTracking());

    ctx.font = font(500, 34);
    ctx.fillStyle = COLOR_SECONDARY;
    const link = clampLines(ctx, `${host}/groups?join=${inviteCode}`, CONTENT_W, 1)[0];
    ctx.fillText(link, cx, inviteTop + INVITE_H - 40);
  } else {
    ctx.font = font(600, 34);
    ctx.fillStyle = COLOR_TEXT;
    const footer = clampLines(ctx, `${host} · compare yours with friends`, CONTENT_W, 1)[0];
    ctx.fillText(footer, cx, disclaimerY - 56);
  }

  ctx.font = font(400, 28);
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText("Not affiliated with Netflix.", cx, disclaimerY);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create the image."));
    }, "image/png");
  });
}
