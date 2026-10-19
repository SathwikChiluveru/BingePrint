---
target: src/components/wrapped
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Sathwik\\fun stuff\\BingePrint\\src\\components\\wrapped"
timestamp: 2026-10-18T13-37-37Z
slug: src-components-wrapped
---
Method: dual-agent (A: design review · B: detector, file + URL mode)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | "Making your card…" shown while validating stored group |
| 2 | Match System / Real World | 3 | "Share my card and invite" creates a group on first tap, doesn't share |
| 3 | User Control and Freedom | 3 | Exit confirm/back excellent; auto-named group with no rename/leave |
| 4 | Consistency and Standards | 3 | Two share paths with different fallbacks; PNG says "1 episode of <movie>" |
| 5 | Error Prevention | 2 | Lost invite funnels invitee into a competing group; stats published without disclosure; double tap can create two groups |
| 6 | Recognition Rather Than Recall | 3 | No join-with-code path on the ending |
| 7 | Flexibility and Efficiency | 3 | Keys, dots, tap zones, autoshare |
| 8 | Aesthetic and Minimalist Design | 3 | Slide 5 carries seven text elements |
| 9 | Error Recovery | 3 | "Saved to your downloads" false in in-app webviews |
| 10 | Help and Documentation | 3 | Estimate notes, binge-day definition, input-aware hint |
| Total | | 29/40 | Good (73%) |

## Design Specificity Verdict
LLM: very close to the brief; designed system, data-specific roast copy, slide 10 one red focal. Deviations: personality climax is the smallest hero (48px vs ~83px numbers); slide 4 has no hero; slide 7 date-only hero is an estimate; slide 8 hero-metric stat row.
Detector: file mode 0 findings across 12 files. URL mode (fallback screen only): 1 advisory bounce-easing from the global --ease-spring token, false positive as page evidence; 0 low-contrast, 0 tiny-text. Grep: 0 emoji/em dashes, 0 hard-coded colors, no arbitrary font sizes, gradient and spring only on heroes, all controls named. Slides themselves not URL-scanned (need localStorage stats).

## Priority Issues
- [P1] Ending has no join path; invitees who lost pendingInvite (switched browser, in-app webview, >7 days) create competing groups (Slide10Share.tsx:393-421). Fix: secondary "Got a code from a friend? Join their group" -> /groups?mode=join. Cmd: harden.
- [P1] Sign-in crosses browsers: "Open in Safari or Chrome" and magic links land where stats don't exist -> MissingReel or auth_failed (login/page.tsx:56,142; wrapped/[sessionId]/page.tsx:21-47). Fix: email OTP code entered in the same tab; default in in-app browsers. Cmd: harden.
- [P2] One-tap create publishes full wrappedStats incl. allBingeSessions titles with no disclosure on slide 10 (Slide10Share.tsx:201). SECURITY: members read policy is `using (true)` (supabase/migrations/001_init.sql:41-42), so anyone with the anon key can read every member's wrapped_data. Fix: disclosure line, strip allBingeSessions, scope the policy. Cmd: clarify + security review.
- [P2] Personality climax undersized (Slide8Personality.tsx:563); slide 7 date-only hero is an estimate. Fix: bigger personality hero, drop stat row, add per-weekday title counts. Cmd: bolder, clarify.
- [P3] Untrue fallbacks/labels: download claim in webviews, "1 episode of Inception" in PNG, focus lost after group creation, create CTA label. Cmd: harden.

## Persona Red Flags
Casey: back chevron top-left; two taps around sign-in; persuasion line hidden on SE; magic link in another browser is a dead end.
Sam: focus lost after group creation; "~" read as tilde; bar heights and blur still animate under reduced motion.
Riley: slide 7 4-digit hero clips at 320px; 201-with-warning treated as success; double-tap creates two groups; date-only top show ranked by estimated seconds; old stats without personality render empty heading.
Invitee: webview + CSV on phone drop-off; invite context lost across browsers; join landing shows no inviter hook; WhatsApp drops text/url with files.

## Minor Observations
Desktop prev/next not using .slide-chrome-btn; auto group name/nickname with no rename; autoshare param persists; slide 5 label wraps; /groups h1 text-3xl instead of text-headline.

## Questions to Consider
- Should slides 2, 3 and 8 seed the friend comparison so the invite pays off a running bit?
- Should the invite landing lead with the inviter's verdict (with consent)?
- Is the system sans the Roast Reel's voice at thumbnail size, or does the card need a display face?
