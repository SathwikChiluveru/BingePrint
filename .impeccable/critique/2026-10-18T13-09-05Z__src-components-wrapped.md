---
target: src/components/wrapped
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\Sathwik\\fun stuff\\BingePrint\\src\\components\\wrapped"
timestamp: 2026-10-18T13-09-05Z
slug: src-components-wrapped
---
Method: dual-agent (A: design review · B: detector)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Invite-mode PNG has a "Join my group" panel the on-screen preview never shows |
| 2 | Match System / Real World | 3 | Movie top show says "1 episode"; "Start over" reads destructive |
| 3 | User Control and Freedom | 2 | X exits with no confirm; no path back into the reel from / or /upload |
| 4 | Consistency and Standards | 3 | Slide 10 has two red focal points; invitee's share text says "my group" |
| 5 | Error Prevention | 2 | Create-mode "Share my card" sends a codeless PNG |
| 6 | Recognition Rather Than Recall | 3 | Self-explanatory slides |
| 7 | Flexibility and Efficiency | 3 | Tap, swipe, keys, dots; no replay |
| 8 | Aesthetic and Minimalist Design | 3 | S2 flags estimate three times; S10 dense |
| 9 | Error Recovery | 3 | Share and join fallbacks name a recovery |
| 10 | Help and Documentation | 2 | "binge day" and missing night-owl slide unexplained; hint omits taps |
| Total | | 27/40 | Acceptable (68%) |

## Design Specificity Verdict
LLM: ~75% on-system, ~50% on-voice. Letter of DESIGN.md followed; template monotony (same stack/entrance every slide, S3 and S9 near clones); punchlines are the smallest text (16px grey); S10 breaks One Red Thing (gradient hero + glow + red CTA).
Detector: 0 anti-patterns; 2 advisories design-system-font-size at ShareCard.tsx:102 (text-[2rem], short:text-[1.75rem]), true. Grep: 0 emoji/em dashes; gradient and spring only on heroes; all controls named; ShareCard.tsx:54 inline glow instead of --glow-hero; ShareCard text-lg and arbitrary clamps off-scale. Element rules not run; browser render blocked by auth.

## Priority Issues
- [P1] Create-mode share leaks the loop: easiest action sends a card with no code (Slide10Share.tsx:306-311, renderShareImage.ts:380-384). Fix: one-tap mint group from slide 10 (auto-name, auto-add owner), re-render PNG with code. Cmd: onboard.
- [P1] Owner two-step gate adds a step after explicit intent (groups/page.tsx:217-219, [groupId]/page.tsx:252-299). Fix: auto-add owner after create when wrappedStats exist; privacy line on create form. Cmd: distill.
- [P1] Invitee hits auth wall before payoff; magic link in another browser context loses localStorage; Google OAuth blocked in in-app webviews (proxy.ts:4, wrapped/[sessionId]/page.tsx:16-18). Fix: render reel without auth, require sign-in only to join; detect in-app browsers; carry invite in redirectTo. Cmd: harden.
- [P2] Roast copy generic/flattering; punchlines undersized; Most loyal after Personality deflates climax. Fix: data-specific lines (date of 51-title day), punchlines white at Title size, reorder. Cmd: bolder.
- [P2] Comparison constant BEST_PICTURE_MARATHON_HOURS = 420 (stats.ts:203) likely ~2x too high (~97 winners x ~2h15 = ~220h); "(estimated)" glued after full stop. Fix: verify and correct constant, put "~" inside the string. Cmd: clarify.

## Persona Red Flags
Casey: X exits with no confirm/resume; "Start over" close to CTAs; persuasion line hidden on short screens.
Sam: gradient heroes may vanish in forced-colors; S7 bars aria-hidden with no text equivalent.
Riley: stale myGroup bakes a dead code into PNG; old date-only stats without hasTimeData show bogus night-owl slide.
Invitee: auth wall; "Finding the group" interstitial twice; own reel says "my group" after joining someone else's.

## Minor Observations
Double safe-area offset on last slide (SlideShow.tsx:275 + globals.css:197); X has no backdrop; desktop end slide lacks exit; S4 truncated titles only via title=; S7 weekly-average framing undersells; members API doesn't dedupe joins per user.

## Questions to Consider
- Should every reel mint a group automatically so "create" mode disappears?
- For date-only users, is "5,626 titles" a better punchline than "~4,046 hours"?
- What if slides 2-8 seeded the comparison so the end CTA pays off tension built across the reel?
