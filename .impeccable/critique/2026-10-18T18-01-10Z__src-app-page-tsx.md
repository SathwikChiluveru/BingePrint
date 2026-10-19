---
target: landing page
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Sathwik\\fun stuff\\BingePrint\\src\\app\\page.tsx"
target_fingerprint: "sha256:d316bbe54310857ee98313f6c74425f70a852071433dabef0cb9cb0ab09a268b"
target_path: "C:\\Users\\Sathwik\\fun stuff\\BingePrint\\src\\app\\page.tsx"
timestamp: 2026-10-18T18-01-10Z
slug: src-app-page-tsx
---
Method: dual-agent (A: design review · B: detector, file + URL mode)
Score 30/40 (75%, Good). All 10 heuristics scored this run (prior run scored 8: 25/32 = 78%). P0 0, P1 2.
Heuristics: 1:3 · 2:4 · 3:3 · 4:2 (BingePrint/reel/wrapped naming; wordmark color differs on /upload) · 5:3 (group sign-in undisclosed) · 6:4 · 7:2 (no "back to my reel" for returning visitors) · 8:3 (privacy x4, 30 seconds x3, three fine-print lines) · 9:3 · 10:3
Detector: source 0 findings; live bounce-easing global token (false positive); OG 200 image/png; og/twitter tags present, no "Netflix Wrapped"; security headers present; all samples labeled; no SSR opacity:0.
Priority: [P1] hero is the category split-hero template, brand world confined to one card — bolder. [P1] primary CTA is a link, not the drop zone — shape. [P2] mobile CTA near/below fold, sample shown twice, two glows — adapt. [P2] group sign-in undisclosed, "No account needed" overclaims, noun drift — clarify. [P2] OG fakes black weight with stroke, no group line, metadataBase falls back to localhost — harden. [P3] repeated reassurance — distill.
