---
target: src/components/wrapped
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Sathwik\\fun stuff\\BingePrint\\src\\components\\wrapped"
timestamp: 2026-10-18T17-36-48Z
slug: src-components-wrapped
---
Method: dual-agent (A: design review · B: detector, file + URL mode)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility | 3 | "Checking your group…" has no timeout |
| 2 | Real world | 3 | Jargon in slide 5 footnote, "eps" |
| 3 | Control | 3 | No route to your group from slide 10 |
| 4 | Consistency | 3 | Invite code case differs; compare page off-system |
| 5 | Error prevention | 3 | In-app default needs {{ .Token }} in email template |
| 6 | Recognition | 3 | Image-only share fallback drops the URL |
| 7 | Flexibility | 2 | Invitee signs in before seeing the group; reel restarts at slide 1 |
| 8 | Minimalist | 2 | Slides 2/3 carry ~6 text tiers; slide 10 create mode 6 controls |
| 9 | Recovery | 3 | Compare page silently redirects on error |
| 10 | Help | 3 | Login says "lives in this browser" to invitees without one |
| Total | | 28/40 | Good (70%) |

## Design Specificity Verdict
LLM: slides 1-9 highly specific; compare page off-system (stat-card grid, text arrows, no roast). Detector: 0 anti-patterns; 1 advisory design-system-font-size Slide8Personality.tsx:21 (intentional climax size, undocumented); URL bounce-easing false positive (global token). 0 emoji, 0 hard-coded colors, 0 target=_blank issues.

## Priority Issues
- [P1] Invitee sign-in wall before value; opt-in teaser hidden behind it (api/groups/lookup/route.ts:21-24, groups/page.tsx:147-155). Fix: anonymous IP-rate-limited preview, sign-in only to join. Cmd: onboard.
- [P1] Compare page generic and mixes estimated with real hours, no "~" (compare/page.tsx:63-125). Fix: roast head-to-head, compare by titles when any member is date-only. Cmd: bolder, clarify.
- [P2] Slide 10 dead-ends once a group exists. Fix: "Open {group}" link. Cmd: onboard.
- [P2] Slides over-explain (two jokes per frame on 2/3/8; slide 5 footnote; slide 10 create stack). Cmd: distill.
- [P3] Code case, dayTitleCounts stripped server-side, owner teaser leads with ~hours, DESIGN.md back-button drift, glow off-center on 4/5. Cmd: polish.

## Persona Red Flags
Casey: reel restarts on reload; slide 10 links below fold at 812. Sam: dot labels lack slide names; compare page unstructured. Riley: old date-only stats without hasTimeData show Night Owl at noon; 0 entries not blocked at upload; movie watched 3x called "episodes". Invitee: sign-in before group; email-code dependency; cross-device double sign-in; placeholder shows "1" which codes never contain.

## Questions to Consider
- Why does the invitee meet a login before their friend's verdict?
- Is "51 titles in one day" the record or the alibi?
- Should slide 10 ship the invite URL as payload with the card attached?
