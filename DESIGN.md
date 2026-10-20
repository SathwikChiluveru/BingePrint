---
name: Autoplayed
description: Your Netflix history as a roast reel you can compare with friends.
colors:
  reel-red: "#e50914"
  reel-red-hover: "#f40612"
  reel-red-text: "#ff4d55"
  reel-red-wash: "rgba(229, 9, 20, 0.15)"
  reel-red-edge: "rgba(229, 9, 20, 0.35)"
  screening-room: "#141414"
  screening-room-veil: "rgba(20, 20, 20, 0.92)"
  seat-row: "#1a1a1a"
  seat-row-raised: "#242424"
  seat-row-hover: "#2e2e2e"
  hairline: "rgba(255, 255, 255, 0.08)"
  hairline-strong: "rgba(255, 255, 255, 0.16)"
  marquee-white: "#ffffff"
  credits-grey: "#b3b3b3"
  usher-grey: "#8c8c8c"
  green-light: "#46d369"
  amber-light: "#f5a623"
  screen-track: "rgba(255, 255, 255, 0.05)"
  screen-track-strong: "rgba(255, 255, 255, 0.55)"
typography:
  hero-stat:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "clamp(4.5rem, 22vw, 8rem)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.05em"
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "clamp(3rem, 8vw, 4.5rem)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body-lg:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.1em"
  mono:
    fontFamily: "ui-monospace, \"SF Mono\", \"Cascadia Code\", Menlo, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  pill: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  "16": "64px"
  "24": "96px"
components:
  button-primary:
    backgroundColor: "{colors.reel-red}"
    textColor: "{colors.marquee-white}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.reel-red-hover}"
    textColor: "{colors.marquee-white}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.seat-row-raised}"
    textColor: "{colors.marquee-white}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.seat-row-hover}"
    textColor: "{colors.marquee-white}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.seat-row}"
    textColor: "{colors.marquee-white}"
    rounded: "{rounded.lg}"
    padding: "24px"
  glass-panel:
    backgroundColor: "rgba(26, 26, 26, 0.8)"
    textColor: "{colors.marquee-white}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.seat-row-raised}"
    textColor: "{colors.marquee-white}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "44px"
  progress-dot:
    backgroundColor: "{colors.seat-row-hover}"
    rounded: "{rounded.pill}"
    height: "8px"
    width: "8px"
  progress-dot-active:
    backgroundColor: "{colors.reel-red}"
    rounded: "{rounded.pill}"
    height: "8px"
    width: "20px"
  slide-chrome-button:
    backgroundColor: "{colors.screening-room-veil}"
    textColor: "{colors.credits-grey}"
    rounded: "{rounded.pill}"
    height: "44px"
    width: "44px"
  exit-confirm:
    backgroundColor: "rgba(26, 26, 26, 0.8)"
    textColor: "{colors.marquee-white}"
    rounded: "{rounded.lg}"
    padding: "16px"
    width: "288px"
  share-card:
    backgroundColor: "{colors.seat-row}"
    textColor: "{colors.marquee-white}"
    rounded: "20px"
    padding: "20px 24px 16px"
---

# Design System: Autoplayed

## Overview

**Creative North Star: "The Roast Reel"**

Autoplayed is a highlight reel that teases you. Every wrapped slide is one punchline: a single enormous number or word lands in the middle of a dark screening room, a red glow blooms behind it, and a line of copy delivers the joke. The reel exists to be screenshotted and dropped into the group chat, so each frame must read in a glance on a phone and still look good cropped.

The atmosphere is cinematic: near-black backgrounds, soft radial red light, glass panels that let the glow through. That glow is the brand's warmth and carries across the whole app, not just the slides. The rest of the interface stays quiet and dark so the hero always wins. Density is low and confident: big type, wide margins, one idea per screen.

The palette is Netflix-adjacent by choice, but Autoplayed is clearly unofficial: it never borrows the Netflix logo, wordmark, or "N" mark, and it says plainly that it is not affiliated.

**Key Characteristics:**
- One hero per frame: a huge black-weight number or word, everything else steps back.
- Cinematic red glow (radial gradients, soft halos) as the signature atmosphere.
- Dark-only: a screening room, never a lit page.
- Bold, punchy, teasing copy set big enough to screenshot.
- Motion that lands like a reveal: hero pops in, context fades up after.

## Colors

One loud red over a stack of near-black grays; everything that is not the hero is grayscale.

### Primary
- **Reel Red** (`reel-red`): The brand. Primary buttons, the hero glow, progress, the one thing on screen that must be acted on. Also the base of the hero-stat gradient (Reel Red to a warm coral, 135deg).
- **Reel Red, Hover** (`reel-red-hover`): Primary button hover only.
- **Reel Red, Text** (`reel-red-text`): Red tuned for small text and links on dark surfaces (at least 4.5:1). Use it whenever red is a text color below 24px; Reel Red itself is for fills and large type.
- **Red Wash** (`reel-red-wash`) and **Red Edge** (`reel-red-edge`): Tinted backgrounds and borders for badges, error boxes, and highlighted rows.

### Neutral
- **Screening Room** (`screening-room`): Page and slide background everywhere.
- **Screening Room Veil** (`screening-room-veil`): Sticky nav and overlays above content.
- **Seat Row** (`seat-row`): Cards and panels.
- **Seat Row, Raised** (`seat-row-raised`): Inputs, secondary buttons, nested cards.
- **Seat Row, Hover** (`seat-row-hover`): Hover fill for neutral controls, scrollbar thumb, inactive progress dots.
- **Hairline** (`hairline`) and **Hairline, Strong** (`hairline-strong`): All borders and dividers; strong for hover states.
- **Marquee White** (`marquee-white`): Primary text and hero stats.
- **Credits Grey** (`credits-grey`): Supporting copy and descriptions.
- **Usher Grey** (`usher-grey`): Labels, captions, timestamps (at least 5:1 on Screening Room and Seat Row).
- **Screen Track** (`screen-track`, token `--color-track`): The empty part of every bar and relative-share fill on slides. Never red.
- **Screen Track, Strong** (`screen-track-strong`, token `--color-track-strong`): The one highlighted bar inside a neutral set (the peak weekday), and the fill of thin relative-share bars over a Screen Track rail (Top five), so the highlight does not spend the frame's red.

### Status
- **Green Light** (`green-light`): Success states.
- **Amber Light** (`amber-light`): Warnings, including "estimated" notices.

### Named Rules
**The One Red Thing Rule.** Each screen has one red focal point: the primary action or the hero glow. If two things are red, one of them is wrong. On slides 1 to 9 the red is the hero (gradient fill plus its glow) and the active progress dot. On slide 10 the red belongs to the primary CTA, so the on-screen share card's hero is white and its glow stays faint; the card never adds a second red. **Exported images are exempt:** the share PNG is the frame that travels, carries no CTA, and fills the personality hero with the red gradient (Reel Red to coral, 135deg) over its glow. The exemption covers the exported file only, never the on-screen preview.

**The Forced Colors Rule.** Transparent-fill text (`.text-gradient-red`) falls back to `CanvasText` under `forced-colors: active`, so heroes never vanish in Windows High Contrast.

**The Small Red Text Rule.** Red text under 24px uses Reel Red, Text, never Reel Red. Reel Red fails contrast at body sizes.
- *Named exception, landing nav wordmark (owner-approved):* the landing nav's "Autoplayed" is Reel Red at 20px (`text-xl`), black weight (900). At that weight it reads as a logo mark, and the owner chose the true brand red. Every other small red text, including the landing footer wordmark, uses Reel Red, Text.

## Typography

**Display Font:** System sans (SF Pro Display on Apple, Segoe UI on Windows, system-ui fallback)
**Body Font:** The same system sans
**Label/Mono Font:** System monospace for codes and file names (`ui-monospace`, SF Mono, Cascadia Code)

**Named exception, link-preview images.** `opengraph-image.tsx` (and `twitter-image.tsx`, which reuses it) render with Inter 600 and 900 (SIL OFL, read from `src/app/fonts/`). The image renderer has no system sans, and its fallback has no black weight, so Inter stands in for the black-weight hero. This applies to the generated preview images only; pages never load Inter.

**Character:** One family pushed to its extremes. Black weight (900) with tight negative tracking for heroes, and plain regular body text, so the contrast comes from size and weight rather than from a second typeface.

### Hierarchy
- **Hero stat** (900, clamp 4.5rem, 22vw, 8rem, line-height 0.95, -0.05em, no wrapping): The one number per wrapped slide, always via the `.slide-hero` class. 22vw (not 14vw) so phones fill the frame instead of sitting on the floor; it reaches the 8rem cap by about 580px. On short screens (max-height 640px) it drops to clamp 3.75rem, 18vw, 6rem. Units inside a hero (h, m, %) use `.slide-hero-unit` at 0.5em and inherit the gradient. Optionally filled with the red gradient. Never more than one per screen.
  - *Named exception, Your week long hero* (clamp 3.5rem, 18vw, min(8rem, 15vh)): Slide 7 heroes of 5+ visible characters ("1,034", "~832h") step down so they fit 320px; the 15vh cap keeps short windows from overflowing.
  - *Named exception, Personality climax* (900, clamp 3.5rem, 15vw, 6.5rem, line-height 0.92, -0.04em, balanced wrap): Slide 8's personality word is the biggest type in the reel on phones and the only hero that may wrap (two lines max at 320px). "The" steps down to a Headline line above it. The invite frame (`InviteFrame`) reuses this exact size for the inviter's personality, because it is the invitee's first look at the reel's climax.
  - *Named exception, Invite group name* (900, clamp 2.5rem, 10vw, 4.5rem): when the inviter hasn't shared a teaser, the invite frame's hero is the group name, which can run to 60 characters, so its floor sits below Display to keep long names on two lines at 320px.
  - *Exported card hero*: the share PNG sets the personality in the red gradient; the on-screen card keeps it white (see The One Red Thing Rule).
- **Display** (900, clamp 3rem to 4.5rem, line-height 0.95, -0.03em): Landing hero and slide headlines.
- **Headline** (700, clamp 1.875rem to 2.25rem, -0.02em): Section titles on landing, groups and compare pages.
- **Title** (600, 1.25rem): Card titles, show names in lists.
- **Body large** (400, 1.125rem, Tailwind `text-lg`): Lead paragraphs under page and section headlines (landing hero from `sm`, group teaser, closing call), and the drop zone's file line from `sm`.
- **Body** (400, 1rem, line-height 1.6): Copy and descriptions in Credits Grey. Cap measure at 60ch.
- **Small** (400 or 600, 0.875rem, Tailwind `text-sm`): Secondary lines, notes, alerts, table rows, nav and secondary buttons, the lock line. Sample captions use 0.75rem (`text-xs`) in Usher Grey: the Label size without caps or tracking. Nothing goes smaller.
- **Label** (600, 0.75rem, 0.1em tracking, uppercase): Slide kickers above hero stats and stat-card labels, in Usher Grey. On slides only; never as an eyebrow above a page headline.

The ramp has no other steps: no arbitrary `text-[...]` sizes, and nothing below 0.75rem. Display, Headline and Title ship as Tailwind utilities (`text-display`, `text-headline`, `text-title`, defined in `@theme` in `globals.css` with their line-height and tracking). Use them instead of arbitrary `text-[...]` sizes.

### Named Rules
**The Size Is The Joke Rule.** The punchline is carried by scale, not decoration. If a hero needs an icon or emoji to land, the number is not big enough.

## Layout

Mobile-first from 375px, with the `md` breakpoint (768px) for larger type and desktop affordances. Spacing follows a 4px grid (`spacing` tokens); section gaps are at least 48px, card padding 24px.

Wrapped slides are full-viewport frames (`.slide-container`: fixed, inset 0) that scroll vertically only when content is taller than the frame, never clipping it. Their content column is a `.slide-stack`: two flexible spacers center the content and collapse when space runs out, so overflow starts at the top and scrolls instead of being cut off above the fold. The top spacer never drops below 56px plus the notch inset (it clears the 44px chrome buttons at 12px); the bottom keeps 16px. SlideShow ends each slide 72px plus the home-indicator inset above the bottom so the counter and dots never cover content. Side padding is 24px on phones and 48px on desktop.

**Short screens** (`short:` variant, max-height 640px: iPhone SE Safari, landscape phones) compact margins, shrink the hero, and hide nonessential lines.

**Input.** Touch swipe changes slide only on a clearly horizontal gesture (50px+, 1.5x more sideways than vertical). Tap zones follow the Stories convention: left third goes back, the rest advances; drags, scrolls, long-presses, text selection and taps on any control are ignored, and the last slide never pages on tap. Arrow keys page; arrow buttons appear only from `md`; the progress dots are buttons.

**Last-slide chrome.** Slide 10 is the screenshot frame: no dots, no counter. On phones the X is hidden and a Back chevron sits bottom-left (12px above the home-indicator inset, in thumb reach); the slide box ends 64px plus the inset above the bottom (`.slide-last-reserve`) so it never covers the card's actions. From `md` the X stays top-right (clear of the 24rem card) and the Prev arrow stays on the left.

**Resume.** The current slide is kept per session in `sessionStorage`, so a reload or app switch reopens the reel where the viewer left it. Storage failures fall back to slide 1. Safe-area insets are counted once, in `.slide-stack`, never again on the slide box.

App pages (landing, upload, groups) use a single centered column: 72rem (`max-w-6xl`) for the nav, the landing hero and the footer; 64rem (`max-w-5xl`) for landing content sections (How it works, the group teaser), which need room for a text column beside an artifact column; about 48rem for app content (groups, compare); 36rem (`max-w-xl`) for forms like upload. Feature lists are divided rows (a 14rem label column beside body text on desktop), not grids of identical cards.

## Elevation & Depth

Depth comes from light, not lift. The signature move is a soft radial red glow behind the hero (an ellipse of Reel Red at 8 to 15% opacity fading to transparent by 70%, shipped as the `--glow-hero` token: `radial-gradient(ellipse 60% 50% at 50% 50%, rgba(229, 9, 20, 0.15) 0%, transparent 70%)`), plus glass panels that blur whatever glow sits behind them. Surfaces stack tonally (Screening Room, Seat Row, Seat Row Raised), and cards carry one soft dark shadow to separate them from the background.

### Shadow Vocabulary
- **Card shadow** (`0 4px 24px rgba(0, 0, 0, 0.4)`): Every card and panel at rest.
- **Button hover** (`0 10px 28px -10px rgba(229, 9, 20, 0.65)`): Red halo under a hovered primary button, offset downward.
- **Hero glow** (`0 0 40px rgba(229, 9, 20, 0.3)`): Around hero elements and progress rings on slides.
- **Ambient glow** (`0 0 60px rgba(229, 9, 20, 0.1)`): Faint wash behind feature panels.

### Named Rules
**The Spotlight Rule.** Glow follows the hero. One glow source per frame, centered on the thing the frame is about; never glow on chrome like nav bars or inputs.

## Shapes

Gently rounded and consistent: 6px on chips and badges, 12px on buttons and inputs, 16px on cards and panels, 24px on large modals and sample-slide frames, and full pills for progress dots and tags. Borders are always 1px Hairline; there are no thick strokes or side-stripe accents. Wrapped slides are portrait frames, and sample slides on the landing page mirror that 9:16 silhouette at 24px corners (the hero reel and How it works' sample frames alike).

## Components

### Buttons
Bold, solid, unmistakable.
- **Shape:** Gently rounded (12px), minimum height 44px, inline-flex with an 8px gap for an icon.
- **Primary:** Reel Red fill, white 600-weight label.
- **Hover / Focus:** Shifts to Reel Red Hover, lifts 1px, and gains the red button-hover halo (150ms, smooth ease). Focus shows a 2px white outline offset 3px. Lift is disabled under reduced motion.
- **Secondary:** Seat Row Raised fill with a Hairline border; hover goes to Seat Row Hover with a strong hairline. Used for "Sign in" and other non-primary actions.
- **Disabled:** 50% opacity, no lift, no halo.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Seat Row, or the glass panel (Seat Row at 80% with 20px backdrop blur) when it sits over a glow.
- **Shadow Strategy:** Card shadow at rest (see Elevation & Depth).
- **Border:** 1px Hairline.
- **Internal Padding:** 24px.

### Inputs / Fields
- **Style:** Seat Row Raised fill, 1px Hairline border, 12px radius, 12px by 16px padding (about 44px tall), red caret. Invite codes use the mono font with wide tracking.
- **Displayed codes:** a code shown for reading or sharing (not typing) is one mono chip (6px radius, Seat Row Raised, 1px Hairline, 0.2em tracking), never a row of per-character boxes, which read as an input to fill in.
- **Focus:** 2px white focus ring (global `:focus-visible`).
- **Error:** Error box in Red Wash with a Red Edge border and Reel Red, Text copy, announced with `role="alert"`, plus a line on how to recover.
- **File drop zones:** every surface that looks like a drop target is one (it uses `useReelUpload`), and while it is mounted the hook's window guard cancels file drags anywhere else on the page, so a near-miss never opens the file in the tab. The copy names the file: "Drop NetflixViewingHistory.csv" on fine pointers, "Pick NetflixViewingHistory.csv" on coarse ones, never "Drop" on touch (CSS `pointer-coarse:` swaps it, so SSR markup matches). On `/upload` the zone holds a red "Choose file" button as the page's one red thing; the landing's zone (How it works, step 2) uses a secondary "Choose file", since the landing's red belongs to the hero and the closing call. Errors use the same copy everywhere (from the hook) and render directly under the zone. One file at a time: drops while parsing are ignored, and a multi-file drop says "Using the first file: {name}" as a `role="status"` note.

### Upload Page
`/upload` is where the landing's "Get my reel" lands, and most first-timers arrive without the file, so a phone's first viewport must carry both the action and the way to get the file. Top to bottom: the shared nav bar (white wordmark, "Back" secondary), a Headline h1 ("Hand over the evidence"), one lock line, the drop zone (20px padding on phones, 40px from `sm`; the file icon shows from `sm` only; under the file name a muted line, "or ViewingActivity.csv from a data request"), the error alert directly under the zone when there is one, otherwise one line on what happens next ("Your reel opens right away. No account needed.", hidden while the alert shows), then the quick steps, always visible: three numbered items (open netflix.com/viewingactivity in a browser, not the app; Download all at the bottom; pick the file), stacked on phones and in three columns from `sm`. The slower full data request (time-of-day stats) lives in a closed `<details>` below them, never in the first view. The not-affiliated line closes the page.

### Navigation
A thin bar on Screening Room Veil: the Autoplayed wordmark (black weight, links home) on the left and one secondary button on the right. No link rows; the app is a funnel, not a site. On the landing page the wordmark is Reel Red (owner-approved look); app chrome (upload, login, groups) uses Marquee White so it never competes with that page's one red action. `/upload` uses the same sticky bar markup as the landing, with "Back" (home) as its secondary. Slide 1 and the exported PNG mark also use Reel Red.

**The Landing Hero (owner-approved, do not redesign without asking).** The protection covers exactly two things: the hero section in `src/app/page.tsx` (`<section aria-labelledby="hero-heading">`: headline "Your watch history has some explaining to do.", the receipts paragraph, the red "Get my reel" button plus the secondary "Join a friend's group", and the lock line) and `SampleReel.tsx` (the sample reel beside it, with the red glow behind it and red-gradient hero numbers, ending on the group versus frame). The landing nav bar stays as is. In the hero, the red button, the red glow and the reel's red numbers coexist by the owner's choice; this overrides The One Red Thing Rule there only. Everything below the hero (How it works, the group teaser, the closing call) follows the normal rules; the hero exemption does not extend to them.

### Landing Below The Hero
- **How it works:** four divided rows (number, text, artifact). Step 2's artifact is a real drop zone (see File drop zones) that routes to `/wrapped/{id}` exactly like `/upload`; its copy links `/privacy` inline ("What's kept, exactly"). Step 3 shows two 9:16 sample frames the hero reel never shows (estimated watch time with its "~", the busiest weekday), with one faint `--glow-hero` behind the active frame only. Step 4 says what a group sees: name, stats and personality, never the file.
- **Group teaser:** one action, the secondary "Join a friend's group"; a muted line points group creation at the reel's last slide. No red button. Its sample numbers come from `sampleData.ts` (`SAMPLE_VERSUS`), and its punchline is its own, never the reel's roommate line.
- **Closing call:** Display line, one Large body line, the red "Get my reel". No glow: the button is the frame's one red thing.

### Wrapped Slide (signature)
A full-screen portrait frame: Screening Room background with a radial red glow centered behind the hero, an uppercase Usher Grey label, the hero stat (pops in with a spring overshoot over about 500ms), then one roast line that fades up about 300ms later. One roast per slide; the only friend dig lives on Personality ("Somebody you know is going to argue with this.", never assuming a group exists; slide 10 sells the group). Centered slides put the glow on the slide; the off-axis slides (Top five and Biggest binge left-aligned, Most loyal right-aligned) anchor it to the hero itself (`HeroGlow`), so it never sits beside the number. Lists inside slides stagger in at 120ms per item, and bars fill over 600ms. Slides transition horizontally over 350ms with a smooth ease. Estimated numbers carry a "~" prefix and a small Usher Grey note; one hedge per number, so a "~" figure never also says "estimated". Every numeric hero is a heading (`role="heading" aria-level={2}`) so screen-reader heading navigation lands on it.

**Composition and entrance vary.** Not every slide is the same centered stack with the same pop. Your week's hero rises out of its baseline behind a clip (like the bars below it); Most loyal is right-aligned and its number wipes in from the right frame edge; the spring pop is the default, not the rule. All clip-path, blur and glow motion has a reduced-motion path (opacity only), since `MotionConfig reducedMotion="user"` drops transforms only.

**The verdict stamp (Personality, the climax).** The one authored moment of the reel: the kicker and "The" fade in, then the personality word is stamped, wiping in left to right behind a closing clip-path while it settles from 1.15x with a short blur (about 750ms, out-expo, no overshoot). Its glow (two stacked `--glow-hero` layers, the frame's only glow) swells past resting strength as the stamp lands and settles back. The description waits a held beat (about 600ms) after the stamp, then the friend dig follows. Reduced motion: everything in place with a short opacity sequence.

**Screenshot watermark.** Slides 2 to 9 carry "**Autoplayed** · {host}" on the same 12px line as the "n / total" counter, inside the nav reserve below the slide box (`aria-hidden`), so a screenshot of any one slide still says where it came from and it never sits over content, scrolled or not. Usher Grey at full opacity on Screening Room (5.5:1). The intro names the product and the card carries its own footer, so they skip it.

**Date-only means not explicitly timed.** Every slide, the card and the PNG treat `hasTimeData !== true` as date-only (estimated hours, exact title counts lead), matching how SlideShow hides Night owl. On Biggest binge, date-only reels show the binge-day definition as a visible muted note ("Your file has dates only, so a binge counts one calendar day."), not screen-reader-only text.

**Top five bars.** Each row carries a thin 4px Screen Track rail under the title with a Screen Track, Strong fill, so the text keeps full contrast and the bars are actually visible. Bars are sized by the metric the list is ranked by: plays (`watchCount`) for date-only reels, watch time otherwise.

**Play counts are sittings.** For timed exports, `ShowStat.watchCount` counts each title once per calendar day, so resumed viewing never inflates "N episodes of X" (Top five's share uses `distinctTitleDays` as its base to match). Date-only exports are already one row per title per day. Copy names a list once: Top five says "your top 5" under its hero and never echoes "these 5".

Slide order: Intro, Total watched, Top show, Top five, Biggest binge, Night owl (shown only when the stats carry `hasTimeData: true`; older stats without the flag skip it), Your week, Most loyal (skipped when it repeats the top show or is missing), Personality, Your card. Personality is the climax and always plays right before the card. An empty history (0 titles) plays only Intro, then the card's empty state.

### Progress Dots
Pills centered at the bottom of the slideshow above a small "n / total" counter: 8px circles in Seat Row Hover when inactive, stretching to a 20px Reel Red pill for the current slide. Each dot is a button with a 44px-tall hit area whose width shrinks so every dot fits at 320px; its label names the slide ("Go to Top show, slide 3 of 8"). Hidden on the last slide.

### Slideshow Chrome
The exit X (top-right) and the mobile Back chevron (bottom-left, last slide only) are 44px circles on Screening Room Veil with a Hairline border and a 12px backdrop blur (`.slide-chrome-btn`), icon in Credits Grey going white on hover. The blur is functional: content scrolling under the button stays legible. Focus uses the global white ring.

### Exit Confirm (signature interaction)
The X never leaves on the first tap. It opens a small glass popover anchored under it: "Leave your reel?", a reassurance line ("Your stats stay saved on this device."), then a neutral Stay button (focused on open) and a quiet "Yes, exit" link home. No red: leaving is not the frame's focal action. It is a non-modal dialog with a minimal focus trap; Escape and outside taps close only the popover and return focus to the X. Escape never drops the reel itself.

### Share Card and Invite Panel (signature)
Slide 10 pairs an on-screen preview of the share PNG with the actions under it. The card (`ShareCard`, Seat Row, 20px corners, max 24rem) reads top to bottom: Autoplayed wordmark (a drawn play-triangle mark with rounded corners beside the word; white on screen, Reel Red in the PNG so the travelling image carries a brand mark while slide 10 keeps one red thing), the personality as a white black-weight hero over one faint glow, the roast line, a short Hairline Strong divider, the top-show punchline, one total with an Usher Grey label, and the host plus "Not affiliated with Netflix." The PNG renderer draws the same content in the same order, with one difference: its personality hero is filled with the red gradient (exported images are exempt from The One Red Thing Rule). Below it, the action panel adapts to context: invited users (a fresh pending invite, including one carried in by `?join=CODE` on `/wrapped/{id}`) get "See how you stack up" as the red CTA, checked before create mode so an invitee never starts a rival group by default; users with their own group get "Share my card and invite" (the PNG carries the join code); everyone else gets create mode, distilled to: the card, one tease line ("Think your friends watch less? Prove it.", hidden on short screens), the red "Start my group and invite" (a user-plus icon, never the share/upload arrow; signed out it reads "Sign in and start my group", so no separate sign-in note), one single-line disclosure ("Stats, never your file. Invites show your personality."; the create request sends `share_teaser: true`), and one secondary row: a "Join a friend's group" secondary button beside a quiet "Share my card". "Upload a different file" is overflow: hidden on short screens, and in create mode below `md`. After "Card shared" with no group, the status reads "Card shared. Now start a group?" and focus returns to the red CTA. Whenever the viewer has a group, a quiet "Open {group name}" link leads to it; after "Card shared" it steps up to a secondary button. Invite codes always display uppercase (card, PNG, share text); share text (from the copy module, roast voice) carries the code as well as the link; the card alone travels with a dare ("Think you watch less Netflix than me?") and the site link. A stored group made from another reel is kept, never cleared: its "Open {group}" link becomes a secondary "Update my stats in {group}" button (`/groups/{id}?update=1`), the card still carries its code once confirmed, and create mode is never offered while a group exists. Create mode fits 375x548 with the secondary row above the fold (the roast line clamps to one line on short screens). Only a 2xx group check confirms the code; 404 forgets the group; 401, 5xx, a network failure or a check past 4s leave it unconfirmed, so the card goes out without the code under "Share my card" and the stored group is kept. Exactly one red button per state.

**Card arrival.** The card is the payoff of the Personality stamp: the card frame fades in, the personality word arrives at 1.3x with a short blur and settles (about 600ms, out-expo, no overshoot), then the rest of the card fades in around it. The word is the slide's `h2` (an sr-only "Your Autoplayed card" heading stands in when the PNG preview replaces the card). Reduced motion: opacity only.

**Invite action names.** Exactly three, used everywhere: "Start my group and invite" (no group yet; creates one), "Share my card and invite" (has a group; the card carries its code), "Share my card" (no invite: no group, an unconfirmed group, or the quiet option). Right after a one-tap create, the follow-up step reads "Share it now"; it is a step label, not a fourth name. Create errors name the problem: a 422 says "Your stats couldn't be read. Upload your file again.", never "try again in a moment".

**Empty reel.** A reel with zero titles has nothing to compare, so slide 10 replaces the card and group creation with "Nothing to share yet", one line saying the file was empty, a red "Upload my history" CTA, and a quiet "Join with a code" (or the existing group link).

### Compare Page (Roast Reel surface)
The group compare page belongs to the Roast Reel, not to a generic dashboard: head-to-head rows rather than a stat-card grid, one hero per section with the glow behind it, a roast line per comparison, and "~" on every estimated number. When any member's stats are date-only, compare titles (exact) rather than mixing estimated and real hours.

### Rules added in critique round 1 (2026-10-20)
- **Action labels never use "&".** All action names come from `src/lib/copy/invite.ts` (`INVITE_ACTIONS`, `JOIN_ACTIONS`, `GROUP_ACTIONS`): "Start my group" (red) and "Join with a code" on `/groups`; "Sign in and start my group" on slide 10 when signed out.
- **One hedge per number.** A "~" figure never also says "estimated". Each reel slide shows at most one method note, only where the slide doesn't explain itself. Estimated figures are whole hours (whole minutes under 1h); exact figures may keep one decimal.
- **Empty data marks.** A zero-value bar is an empty track (1px Hairline Strong), never a filled minimum stub.
- **Live region.** "{Title}: {hero summary}, slide N of M"; intro and card announce the title only.
- **The group check never blocks sharing.** During the 4s check the card shares without a code under "Share my card", and gains the code once the group is confirmed.
- **Intro additions.** With a fresh invite, slide 1 adds "{group} is waiting at the end." (text-sm, secondary). Returning viewers get a quiet 44px "Skip to my card" text button.
- **Signed-out invitees go straight to sign-in.** Slide 10's stackUp CTA reads "Sign in to add my reel" and returns to the group with the add form open.
- **Login.** `--glow-hero` behind the card; the email or Sign in button is the one red action. The intent line names the personality when a reel is on the device. The 6-digit code is the default in in-app browsers and on touch devices, and the link-sent step always shows the code field ("type it in this same browser").
- **Group member page.** Header: group name at Display (Headline past 24 characters) over `--glow-hero`, then the standings. At most one banner, by priority: update > joined > add my reel > outdated stats. The invite block sits below the standings, except for a member alone in a fresh group. A quiet "New since your last visit: N joined." line comes from a per-device count, members only.

### Rules added in critique round 2 (2026-10-20)
- **Codes go through `InviteCodeChip`** (inline, md, lg sizes): one mono chip, 0.2em tracking, Seat Row Raised fill, Hairline border, weight 600. The share PNG and the compare PNG draw the same chip.
- **The invite frame names the inviter.** The h1 reads "{Nickname} is" / "{Personality}" ("Sam is The Binge Lord"), falling back to "Your friend is". The owner's nickname rides in the opt-in teaser, kept in sync by a database trigger. Disclosures say friends with the code see your name and personality.
- **Names are editable, membership is reversible.** After one-tap create, slide 10 shows prefilled inline "Group name" (owner) and "Your name" fields under "Share it now"; Enter or blur saves, Escape reverts, sharing never waits. The group page has a quiet "Rename group" (owner), a "Your name: X · Edit" line, and "Leave {group}" with an inline confirm at the bottom (an owner who leaves keeps the group).
- **The group page doesn't repeat compare.** With 2+ members it leads with the head-to-head summary and a top-3 preview (plus the viewer); the full standings and awards live on compare only. Compare puts its h1 first in the DOM.
- **Slide 10 labels never flicker.** The create CTA reads as signed out until auth resolves and only switches when not focused or pressed. Group names over 24 characters fall back to "your group" in buttons; the card invite label reads "Join {group}".
- **Exits and skips.** The last slide on phones has a quiet 44px "Home" link opposite Back. With a fresh invite, the intro shows "Skip to {group}" instead of "Skip to my card".
- **Slide 4 and 5 limits.** With 5 or fewer different titles, slide 4's hero is that count, not a percentage. Date-only slide 5 shows at most 5 text elements.
- **Personalities.** "The Genre Surfer" is now "The Channel Surfer" (the export has no genre data); The Casual Viewer's line carries no count. `upgradeStoredStats` upgrades older saved and stored stats.

## Do's and Don'ts

### Do:
- **Do** give every wrapped slide exactly one hero stat at hero-stat size (or a named exception), with the red glow centered behind it.
- **Do** use Reel Red, Text (`#ff4d55`) for any red text under 24px.
- **Do** keep the spring overshoot easing (0.34, 1.56, 0.64, 1) for hero pop-ins on slides only, as a framer-motion constant in the slide component; there is no global CSS spring token. UI chrome uses the smooth or out-expo easing.
- **Do** mark estimated numbers with "~" and a short Usher Grey note.
- **Do** keep a 44px minimum touch target on every control and a visible white focus ring.
- **Do** say "not affiliated with Netflix" wherever the brand could be mistaken as official.
- **Do** build slide columns with `.slide-container` plus `.slide-stack` so tall content scrolls instead of clipping.
- **Do** use `--glow-hero`, `--color-track` and `--color-track-strong` instead of inline glows and bar fills.
- **Do** ask before leaving the reel; keep slide 10's red on the CTA.

### Don't:
- **Don't** use the Netflix logo, wordmark, or "N" mark anywhere.
- **Don't** use gradient text on page headings; the red gradient belongs to slide hero stats only.
- **Don't** put more than one glow source or more than one red focal point in a frame.
- **Don't** use emoji as icons; use inline SVG.
- **Don't** add uppercase eyebrow labels above page headlines; labels live on slides and stat cards.
- **Don't** build rows of identical icon-plus-heading cards; use divided lists.
- **Don't** introduce a light theme; the system is dark-only.
- **Don't** add `env(safe-area-inset-top)` to a slide box; `.slide-stack` already reserves it.
- **Don't** use `justify-content: center` on a slide column; it cuts off overflow above the fold.
