---
target: src/components/wrapped
total_score: 17
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\Sathwik\\fun stuff\\BingePrint\\src\\components\\wrapped"
timestamp: 2026-10-18T11-14-39Z
slug: src-components-wrapped
---
Method: dual-agent (A: design review · B: detector)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Dots only; no "n of N", no SR announcement; copy link has no "Copied" feedback |
| 2 | Match System / Real World | 2 | S7 "average {day}" is an all-time total; "Your {year}" vs all-time; "times watched" = episodes |
| 3 | User Control and Freedom | 2 | No exit/home except S10 links; arrows desktop-only |
| 4 | Consistency and Standards | 2 | Kicker colors, glow presence, number formatting all vary |
| 5 | Error Prevention | 1 | S9 crashes with 0 shows; S3 blank frame; no clipboard try/catch |
| 6 | Recognition Rather Than Recall | 3 | One idea per slide, labeled |
| 7 | Flexibility and Efficiency | n/a | Linear reel; keyboard + dot jump enough |
| 8 | Aesthetic and Minimalist Design | 2 | Emoji clutter, hero-metric stacks, S2 shows days twice |
| 9 | Error Recovery | 1 | Silent clipboard failure; shared link dead-ends |
| 10 | Help and Documentation | n/a | Self-explanatory reel |
| Total | | 17/32 | Acceptable (53%) |

## Design Specificity Verdict
LLM: mostly category-interchangeable. Copy is authored; visuals are a generic Wrapped template (emoji mascots, hero-metric stacks, red kickers everywhere). Breaks DESIGN.md: emoji icons on 8 slides, red kickers at #e50914 text-sm (~3.85:1, fails AA) on 7 slides, gradient text on non-hero elements (S1:43, S10:45 wordmark; S3:43, S9:46 titles; S7:32 weekday), spring on emoji/bars and infinite loops (S1:27, S5:29), glow missing on S4-S7, S9.
Detector: 0 findings across 11 files (regex-only; element rules like contrast/tiny-text did not run, browser render blocked by auth). Detector undercounts; LLM review caught all issues above.

## Priority Issues
- [P0] Share CTA broken, group CTA demoted (S10:13-17, 64-79). /wrapped/{id} is auth-gated + reads viewer's own localStorage, so friends see nothing. Fix: primary = start group + show invite code; drop copy link until public share route; copied/failed aria-live; replace 🎉 with a share card. Cmd: clarify, onboard.
- [P1] Data-truth bugs: S7:41 "average" is all-time total; S5 can show >24h "in a single day" (51×40min); S3:78 renders literal "You&apos;ve"; stats.ts funComparison totalHours*60; S9:63 "times watched"; S10:55 unformatted number. Cmd: harden.
- [P1] Emoji icons + red overload break Roast Reel rules; kickers fail AA; S8 rainbow palette off-brand. Fix: delete emoji, kickers Usher Grey, red only hero/glow, gradient only numeric heroes. Cmd: quieter, colorize.
- [P1] Slideshow a11y: dots 8px unlabeled, arrows 40px glyph-only, no live region/carousel semantics, no MotionConfig reducedMotion, infinite loops, global ArrowUp/Down hijack. Cmd: audit, harden.
- [P2] Peak undersized (S8 personality 4xl next to emoji, too early); S9 duplicates S3 with date-only data. Fix: personality as hero-scale penultimate reveal; skip S9 when same show. Cmd: bolder, distill.

## Persona Red Flags
Casey: tiny dot targets, no count, dots may overlap S10 "Start over" on short screens, screenshots carry no branding and include dots.
Sam: unlabeled controls, silent slide change, emoji read aloud, 3.85:1 kickers, no reduced motion, no focus management.
Riley: 0 entries -> S3 blank, S9 throws, S7 "You live for Mons 0.0h", S4 empty Hall of Fame; long titles overflow at 375px on S3/S9; S8 builds invalid `var(--color-red)18` for unknown personality.
Invitee: copied link -> sign-in -> /upload with no context, no invite code, never sees sender's stats.

## Minor Observations
S1 hard-codes current year; S6 night-owl threshold 50 vs personality 60; S7 bars spring past their value; S8 numbers unformatted; S5 whileInView + infinite animate conflict.

## Questions to Consider
- Why no purpose-built share-card frame (name, 3 best stats, invite code, no chrome)?
- Should the personality reveal be the ending and lead straight into "who in your group is the real Binge Lord"?
- With date-only data, would the roast land harder on certain counts (341 episodes, 51 titles in a day) than ~hours?
