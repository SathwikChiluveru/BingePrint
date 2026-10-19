import { safeInviteCode } from "@/lib/share/safety";

/**
 * Head-to-head share card for the compare page: 1080x1920 PNG drawn on a canvas, system fonts only.
 * Same palette and footer as the reel's share card (renderShareImage): wordmark, one white hero over
 * one red glow, the invite panel, and "Not affiliated with Netflix." Every value is exact (titles or
 * real hours), never an estimate, so nothing on the card carries a "~".
 */
export interface CompareImageInput {
  groupName: string;
  leaderName: string;
  leaderValue: number;
  /** "titles" or "hours", already pluralised for leaderValue */
  unit: string;
  /** null when the leader is alone at the top of a one-member board (not expected on compare) */
  runnerUpName: string | null;
  /** Leader's margin over second place, in the same unit; 0 on a tie */
  gap: number;
  /** Unit for the gap, pluralised for gap */
  gapUnit: string;
  punchline: string;
  inviteCode: string;
  ownedByMe: boolean;
}

const WIDTH = 1080;
const HEIGHT = 1920;
const PAD_X = 96;
const CONTENT_W = WIDTH - PAD_X * 2;

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const MONO_STACK = 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace';

const COLOR_BG = "#141414";
const COLOR_SURFACE = "#1a1a1a";
const COLOR_TEXT = "#ffffff";
const COLOR_SECONDARY = "#b3b3b3";
const COLOR_MUTED = "#8c8c8c";
const COLOR_BORDER = "rgba(255, 255, 255, 0.12)";

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

function font(weight: number, size: number, stack = FONT_STACK) {
  return `${weight} ${size}px ${stack}`;
}

function setTracking(ctx: Ctx, px: number) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`;
}

/** Greedy word wrap; a single word wider than maxWidth is broken by character. */
function wrapLines(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const ch of Array.from(word)) {
      if (line && ctx.measureText(line + ch).width > maxWidth) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

function clampLines(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  const lines = wrapLines(ctx, text, maxWidth);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

function drawLabel(ctx: Ctx, text: string, x: number, y: number, maxWidth = CONTENT_W) {
  ctx.font = font(600, 30);
  ctx.fillStyle = COLOR_MUTED;
  setTracking(ctx, 3);
  const line = clampLines(ctx, text.toUpperCase(), maxWidth, 1)[0] ?? "";
  // Native letterSpacing adds trailing space after the last glyph; offset half of it.
  ctx.fillText(line, x + 1.5, y);
  setTracking(ctx, 0);
}

function siteHost() {
  try {
    return window.location.host || "autoplayed";
  } catch {
    return "autoplayed";
  }
}

/** Largest size (down to min) at which `text` fits in maxLines lines. */
function fitHero(ctx: Ctx, text: string, max: number, min: number, maxLines: number) {
  for (let size = max; size >= min; size -= 4) {
    ctx.font = font(900, size);
    setTracking(ctx, -size * 0.03);
    const lines = wrapLines(ctx, text, CONTENT_W);
    if (lines.length <= maxLines) return { size, lines };
  }
  ctx.font = font(900, min);
  setTracking(ctx, -min * 0.03);
  return { size: min, lines: clampLines(ctx, text, CONTENT_W, maxLines) };
}

export function compareCardCaption(input: Pick<CompareImageInput, "runnerUpName" | "gap" | "gapUnit">) {
  if (!input.runnerUpName) return "Top of the group";
  if (input.gap === 0) return `Dead even with ${input.runnerUpName}`;
  return `${input.gap.toLocaleString()} ${input.gapUnit} ahead of ${input.runnerUpName}`;
}

export async function renderCompareImage(input: CompareImageInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d") as Ctx | null;
  if (!ctx) throw new Error("Canvas is not supported in this browser.");

  const cx = WIDTH / 2;
  const host = siteHost();
  const code = safeInviteCode(input.inviteCode)?.toUpperCase() ?? "";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ----- Fixed zones -----
  const WORDMARK_Y = 200;
  const disclaimerY = HEIGHT - 104;
  const INVITE_H = 360;
  const inviteTop = disclaimerY - 72 - INVITE_H;
  const bottomZoneTop = code ? inviteTop : disclaimerY - 90;
  const zoneTop = WORDMARK_Y + 96;
  const zoneBottom = bottomZoneTop - 96;
  const available = zoneBottom - zoneTop;

  // ----- Measure the content block -----
  const LABEL_H = 30;
  const GAP_LABEL_HERO = 56;

  const VERB_SIZE = 48;
  const GAP_HERO_VERB = 40;

  const STAT_SIZE = 150;
  const GAP_VERB_STAT = 72;
  const STAT_LABEL_GAP = 60;

  const CAPTION_SIZE = 44;
  const GAP_STAT_CAPTION = 64;

  const GAP_SECTION = 64;
  const PUNCH_SIZE = 54;
  const PUNCH_LH = 68;
  ctx.font = font(700, PUNCH_SIZE);
  const punchLines = input.punchline ? clampLines(ctx, input.punchline, CONTENT_W, 2) : [];

  const restH =
    LABEL_H +
    GAP_LABEL_HERO +
    GAP_HERO_VERB +
    VERB_SIZE +
    GAP_VERB_STAT +
    STAT_SIZE * 0.8 +
    STAT_LABEL_GAP +
    GAP_STAT_CAPTION +
    CAPTION_SIZE +
    (punchLines.length ? GAP_SECTION * 2 + 2 + punchLines.length * PUNCH_LH : 0);

  // Leader's name: shrink the ceiling until the whole block fits the free space
  const leaderName = input.leaderName.trim() || "Someone";
  let hero = fitHero(ctx, leaderName, 176, 96, 2);
  for (let max = hero.size - 8; hero.lines.length * hero.size * 0.98 + restH > available && max >= 72; max -= 8) {
    hero = fitHero(ctx, leaderName, max, Math.min(72, max), 2);
  }
  const heroLineH = hero.size * 0.98;
  const heroH = hero.lines.length * heroLineH;
  const blockH = restH + heroH;
  const blockTop = zoneTop + Math.max(0, (available - blockH) / 2);

  // One glow source, centered behind the leader's name
  const glowY = blockTop + LABEL_H + GAP_LABEL_HERO + heroH / 2;
  const glow = ctx.createRadialGradient(cx, glowY, 0, cx, glowY, WIDTH * 0.75);
  glow.addColorStop(0, "rgba(229, 9, 20, 0.15)");
  glow.addColorStop(1, "rgba(229, 9, 20, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Wordmark
  ctx.font = font(900, 64);
  ctx.fillStyle = COLOR_TEXT;
  setTracking(ctx, -1);
  ctx.fillText("Autoplayed", cx, WORDMARK_Y);
  setTracking(ctx, 0);

  let y = blockTop;

  // Group name as the kicker
  drawLabel(ctx, input.groupName.trim() || "The group", cx, y + LABEL_H * 0.8);
  y += LABEL_H + GAP_LABEL_HERO;

  // Leader's name, the one hero
  ctx.font = font(900, hero.size);
  setTracking(ctx, -hero.size * 0.03);
  ctx.fillStyle = COLOR_TEXT;
  hero.lines.forEach((line, i) => ctx.fillText(line, cx, y + hero.size * 0.82 + i * heroLineH));
  setTracking(ctx, 0);
  y += heroH + GAP_HERO_VERB;

  ctx.font = font(400, VERB_SIZE);
  ctx.fillStyle = COLOR_SECONDARY;
  ctx.fillText("watched the most", cx, y + VERB_SIZE * 0.85);
  y += VERB_SIZE + GAP_VERB_STAT;

  // Leader's total in the shared unit
  let statSize = STAT_SIZE;
  const statText = input.leaderValue.toLocaleString();
  ctx.font = font(900, statSize);
  setTracking(ctx, -4);
  while (ctx.measureText(statText).width > CONTENT_W && statSize > 64) {
    statSize -= 4;
    ctx.font = font(900, statSize);
  }
  ctx.fillStyle = COLOR_TEXT;
  ctx.fillText(statText, cx, y + STAT_SIZE * 0.8);
  setTracking(ctx, 0);
  drawLabel(ctx, input.unit, cx, y + STAT_SIZE * 0.8 + STAT_LABEL_GAP);
  y += STAT_SIZE * 0.8 + STAT_LABEL_GAP + GAP_STAT_CAPTION;

  // The gap
  ctx.font = font(600, CAPTION_SIZE);
  ctx.fillStyle = COLOR_TEXT;
  ctx.fillText(clampLines(ctx, compareCardCaption(input), CONTENT_W, 1)[0] ?? "", cx, y + CAPTION_SIZE * 0.85);
  y += CAPTION_SIZE;

  // Divider + punchline
  if (punchLines.length) {
    y += GAP_SECTION;
    ctx.fillStyle = COLOR_BORDER;
    ctx.fillRect(PAD_X + CONTENT_W * 0.3, y, CONTENT_W * 0.4, 2);
    y += 2 + GAP_SECTION;
    ctx.font = font(700, PUNCH_SIZE);
    ctx.fillStyle = COLOR_SECONDARY;
    punchLines.forEach((line, i) => ctx.fillText(line, cx, y + PUNCH_SIZE * 0.85 + i * PUNCH_LH));
  }

  // ----- Invite panel -----
  if (code) {
    ctx.fillStyle = COLOR_SURFACE;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(PAD_X, inviteTop, CONTENT_W, INVITE_H, 40);
    else ctx.rect(PAD_X, inviteTop, CONTENT_W, INVITE_H);
    ctx.fill();
    ctx.strokeStyle = COLOR_BORDER;
    ctx.lineWidth = 2;
    ctx.stroke();

    drawLabel(ctx, input.ownedByMe ? "Join my group" : "Join our group", cx, inviteTop + 84);

    let codeSize = 120;
    ctx.font = font(700, codeSize, MONO_STACK);
    setTracking(ctx, codeSize * 0.18);
    while (ctx.measureText(code).width > CONTENT_W - 96 && codeSize > 56) {
      codeSize -= 4;
      ctx.font = font(700, codeSize, MONO_STACK);
      setTracking(ctx, codeSize * 0.18);
    }
    ctx.fillStyle = COLOR_TEXT;
    ctx.fillText(code, cx + codeSize * 0.09, inviteTop + 124 + codeSize * 0.8);
    setTracking(ctx, 0);

    ctx.font = font(500, 34);
    ctx.fillStyle = COLOR_SECONDARY;
    ctx.fillText(clampLines(ctx, `${host}/groups?join=${code}`, CONTENT_W - 96, 1)[0] ?? "", cx, inviteTop + INVITE_H - 64);
  } else {
    ctx.font = font(600, 34);
    ctx.fillStyle = COLOR_TEXT;
    ctx.fillText(clampLines(ctx, `${host} · compare yours with friends`, CONTENT_W, 1)[0] ?? "", cx, disclaimerY - 56);
  }

  ctx.font = font(400, 28);
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText("Not affiliated with Netflix.", cx, disclaimerY);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image."))), "image/png");
  });
}
