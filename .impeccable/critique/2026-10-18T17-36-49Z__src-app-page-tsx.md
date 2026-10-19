---
target: landing page
total_score: 25
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Sathwik\\fun stuff\\BingePrint\\src\\app\\page.tsx"
target_fingerprint: "sha256:e43c360da70c33729f47d11f43cb0d7ccb943eabd9042fdc2c6afa5c1069929b"
target_path: "C:\\Users\\Sathwik\\fun stuff\\BingePrint\\src\\app\\page.tsx"
timestamp: 2026-10-18T17-36-49Z
slug: src-app-page-tsx
---
Method: dual-agent (A: design review · B: detector, file + URL mode)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility | 3 | Reel entrance/autoplay run off-screen on mobile |
| 2 | Real world | 4 | Uses Netflix's own path, file name, labels |
| 3 | Control | 3 | Cold "Start a group" fails with 401 only after submit |
| 4 | Consistency | 2 | Inherited OG "Your Netflix Wrapped"; four reds in hero |
| 5 | Error prevention | 3 | CTA doesn't warn a file export is needed first |
| 6 | Recognition | 4 | File name, URL, code format shown |
| 7 | Flexibility | n/a | Single-funnel Persuade surface |
| 8 | Minimalist | 3 | Long hero subcopy; step 1 dual export paths; ReelArtifact repeats numbers |
| 9 | Recovery | 3 | Generic upload error copy at destination |
| 10 | Help | n/a | HowItWorks is the inline help |
| Total | | 25/32 | Good (78%) |

## Design Specificity Verdict
LLM: ~60% authored (copy, sample reel, step artifacts), ~40% template (split hero skeleton). Detector: file mode 1 advisory (SampleReel.tsx:170 text-[2.75rem] off-scale, true). URL mode: gradient-text on reel hero (false positive, one per frame), bounce-easing global token (false positive); 0 contrast, 0 tiny-text. Security headers present. All samples labeled, no fabricated claims.

## Priority Issues
- [P1] Link preview says "Your Netflix Wrapped", no og:image (layout.tsx:11-18). Fix: landing openGraph/twitter + 1200x630 sample image. Cmd: clarify, harden.
- [P1] Hero sells solo reel only; group idea unproven above fold; reel below fold at 375px. Fix: head-to-head sample slide, promote group line, proof above subcopy on mobile. Cmd: bolder, layout.
- [P2] CTA leads to a file chore unannounced; opacity-0 SSR initial states render blank before hydration. Fix: "30-second export, no account" line; visible-default entrances, whileInView. Cmd: clarify, animate.
- [P2] One Red Thing broken in first viewport (wordmark, CTA, gradient hero, glow). Fix: white reel hero, CTA owns red. Cmd: quieter.
- [P2] Group section pushes join for cold visitors; "Start a group" fails after submit. Fix: "Get my reel, then start a group" -> /upload. Cmd: clarify, onboard.
- [P3] "Ten slides of evidence" untrue for quick export. Cmd: clarify.

## Persona Red Flags
Jordan: expects a reel, gets a file request; "Sign in" in nav implies account. Riley: 320px H1 may overflow; blank before hydration; OG mismatch. Casey: CTA near fold, reel 1.2 screens down; 768-1023px wasted.

## Questions to Consider
- What if the first viewport were the reel itself?
- Would "You vs. your roommate" convert better than a solo hook?
- What makes a cropped screenshot unmistakably BingePrint?
