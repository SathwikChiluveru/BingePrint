---
target: src/components/wrapped
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\Sathwik\\fun stuff\\BingePrint\\src\\components\\wrapped"
timestamp: 2026-10-18T11-27-41Z
slug: src-components-wrapped
---
Method: dual-agent (A: design review · B: detector)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Counter, dots, live region; live region announces position only |
| 2 | Match System / Real World | 3 | Roast lands; colon truncation ("Mission: Impossible" -> "Mission"); movies labeled "episodes" |
| 3 | User Control and Freedom | 2 | Escape/X push to / with no way back to the reel |
| 4 | Consistency and Standards | 2 | Three estimate notations; hero scale varies (S5, S6, S7) |
| 5 | Error Prevention | 2 | One Escape drops session; 0 entries -> hasTimeData true -> S6 "Early Bird 0%" |
| 6 | Recognition Rather Than Recall | 3 | Slides self-label; "~" explained only on S2/S4 |
| 7 | Flexibility and Efficiency | 2 | No Home/End, no save/share shortcut |
| 8 | Aesthetic and Minimalist Design | 3 | Strong frames; S5 six tiers; totals repeated S2/S8/card |
| 9 | Error Recovery | 3 | Witty empty states; silent redirect on session mismatch |
| 10 | Help and Documentation | 2 | "arrow keys" hint on phones; no "how calculated" |
| Total | | 25/40 | Acceptable (63%) |

## Design Specificity Verdict
LLM: mostly faithful to The Roast Reel; rules applied deliberately (one glow, gradient only on heroes, spring only on heroes, muted kickers, no emoji). Drift on S6 (48px hero), S7 (no hero), S10 (second red focal point).
Detector: 0 anti-patterns, 2 advisories design-system-font-size (ShareCard.tsx:117 1.75rem; Slide8Personality.tsx:57 clamp to 5rem), both true minor. Grep: ShareCard.tsx:70 18px wordmark in --color-red (Small Red Text rule fail, agrees with LLM); spring on empty-state headlines S3:103, S9:115; glow rgba duplicated in 11 files. Element rules (contrast/tiny text) not run; browser render blocked by auth.

## Priority Issues
- [P1] Short phones: .slide-container overflow:hidden + centered -> S4 clips (~550px needed vs ~476px), S10 CTA below fold (redundant pb-[88px] on top of 72px nav reserve). Fix: scroll-safe inner wrapper per slide, S10 pb-6, max-height:640px compaction. Cmd: adapt.
- [P1] ShareCard is not a share artifact: no URL/invite, no save/share button, screenshot includes X (overlaps card corner), dots, CTA. Fix: navigator.share with rendered image + download fallback, domain line, hide chrome on last slide. Cmd: delight, layout.
- [P1] CTA lands on generic /groups chooser, loses context; invitee gets "Start a group". Fix: /groups?mode=create or inline create with prefilled name then invite code; pending-invite-aware CTA; groups page fixes (glyph arrows, red error text, "2024"). Cmd: onboard, clarify.
- [P2] Escape/X destroy session, no resume. Fix: drop Escape exit, "Resume your BingePrint" on /. Cmd: harden.
- [P2] Hero/red drift: S7 no hero, S6 48px hero vs h2, ShareCard red 18px wordmark + glass with nothing to blur. Cmd: bolder, polish.

## Persona Red Flags
Casey: S4 clip, S10 CTA off-screen, "arrow keys" hint, X over card, 10 dots overflow 320px, no safe-area inset.
Sam: gradient text invisible in forced-colors; S7 chart aria-hidden with no summary; live region position-only, no focus move; Escape exits.
Riley: old stats without titleCount -> S5 falls back to showCount labeled titles; single movie counts as binge day; 0 entries -> S6 Early Bird 0%; ShareCard unguarded topShows/totalEpisodesEstimate.
Invitee: screenshot carries no URL/code; invitee's reel ends "Start a group" not "Join {friend}'s group".

## Minor Observations
S2 note says "episode counts" (movies too); "~" prefix on whole comparison sentence; Oscar line undersells; S7 animates height and 60ms stagger; kickers above headings on S4/S6/S7; dead code (uniqueShowsCount, sessionId prop, S9 unreachable branch).

## Questions to Consider
- Why a screenshot of a page rather than a generated 9:16 image with URL and invite code?
- Should S10 create the group in one tap so every screenshot is an invitation?
- Should S4/S7 slot preview the group comparison instead?
