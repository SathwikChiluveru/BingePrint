---
target: src/components/wrapped
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\Sathwik\\fun stuff\\BingePrint\\src\\components\\wrapped"
timestamp: 2026-10-18T11-46-06Z
slug: src-components-wrapped
---
Method: dual-agent (A: design review · B: detector)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Live region says position only; dots/counter gone on last slide |
| 2 | Match System / Real World | 3 | "Time you'll never get back" kicker over a title count (S2:42) |
| 3 | User Control and Freedom | 2 | Swipe-only on mobile, no tap zones; iOS edge-swipe triggers browser Back on last slide; no resume |
| 4 | Consistency and Standards | 2 | Hero size differs S5/S6/S7/S8; share preview (white personality) vs PNG (red gradient); group page drops "~" |
| 5 | Error Prevention | 2 | Creator never a member (P0); pendingInvite never expires |
| 6 | Recognition Rather Than Recall | 3 | Hint on S1 only; dots act as map |
| 7 | Flexibility and Efficiency | 2 | No tap zones, no replay |
| 8 | Aesthetic and Minimalist Design | 3 | S3/S9 stack 6 type tiers |
| 9 | Error Recovery | 2 | Share failure blames rendering even when only navigator.share was refused |
| 10 | Help and Documentation | 3 | Inline estimate notes sufficient |
| Total | | 25/40 | Acceptable (63%) |

## Design Specificity Verdict
LLM: on-brief but templated: identical stack, glow constant, fade-up on every slide; personality peak doesn't escalate. Hero scale inconsistent (S5 text-7xl, S6 text-5xl, S8 3-5rem, S7 none). One-red rule broken on S6 (arc + gradient + glow), S7 (glow + red bar), S1.
Detector: 0 anti-patterns; 2 advisories design-system-font-size (Slide4TopShows.tsx:40 short:text-[2rem]; Slide8Personality.tsx:57 clamp to 5rem), both true. Grep: 0 emoji, 0 infinite loops, gradient and spring only on heroes, all icon controls named; glow rgba duplicated in 11 places; many off-scale sizes (text-lg, text-2xl, .slide-hero 22vw). Element rules not run; browser render blocked by auth.

## Priority Issues
- [P0] Group creator is never a member: POST /api/groups inserts the group only (api/groups/route.ts:29-33); creator lands on 0 members with "Share invite" as primary; first invitee sees 1 member and locked Compare. Fix: add owner as member on create when wrappedStats exist (nickname on create form), or gate Share invite behind joining. Cmd: harden, onboard.
- [P1] Shared card can't recruit: PNG footer has host only, no code/link; navigator.share sends files without text/url (Slide10Share.tsx:89); card omits roast line and 341-episode punchline. Fix: merge "Share my card + invite" (create/reuse group, draw code, pass invite URL), swap one total for the roast line/top-show count. Cmd: clarify, bolder.
- [P1] Share fragile on iOS Safari: share() called after fonts.ready + toBlob of 1080x1920 PNG, may lose transient activation -> NotAllowedError mislabeled as render failure. Fix: pre-render blob on mount, share synchronously, fallback on NotAllowedError, split error copy. Cmd: harden.
- [P2] Group page shows bare "{totalHours}h" for date-only members (groups/[groupId]/page.tsx:211); hero scale inconsistent S5-S8, S5 text-7xl may overflow at 320px. Cmd: typeset, clarify.
- [P3] No tap-to-advance zones; focus lost to body when last slide unmounts nav. Cmd: adapt, polish.

## Persona Red Flags
Casey: taps do nothing; edge-swipe Back risk; "Prove it." hidden on iPhone SE; no resume after exit.
Sam: announcements lack slide title; focus lost at end; S6 strokeDashoffset/delays still animate under reduced motion.
Riley: bare hours in group list; Oscar line undersells ~10x; colon truncation ("Mission: Impossible" -> "Mission"); legacy stats without hasTimeData show night-owl slide; 0 entries -> hasTimeData true.
Invitee: must sign in to view own local wrapped; joins a group with 1 member; stale pendingInvite redirects future reels.

## Minor Observations
Nested scroller in S10; greedy wrap in PNG ("The Binge / Lord") and ~300px dead space; em dash in funComparison copy; desktop hint duplicates Next button; "Officially" kicker + host line duplicate PNG footer.

## Questions to Consider
- Why does the outbound artifact carry two totals and a URL but not the roast line or 341-episode punchline?
- Should the end slide be the group lobby: create silently, print code on the card, share = invite?
- What makes the personality reveal feel like the climax if every slide shares one entrance?
