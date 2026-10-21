---
target: src/components/wrapped
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\Sathwik\\fun stuff\\BingePrint\\src\\components\\wrapped"
timestamp: 2026-10-21T13-46-18Z
slug: src-components-wrapped
---
Method: dual-agent (A: design review on local build, quick + full export · B: CLI + browser metrics + overlay). Score 31/40 (77.5/100).
Heuristics: 1:4 2:3 3:3 4:3 5:3 6:3 7:3 8:3 9:3 10:3
Detector: CLI 0; overlay gradient-text + kicker-above-heading on Slide2 (design-system choice). /groups?join 404 body never consumed (networkidle never reached).
[P1] Night slide "Early bird" kicker contradicts 10pm-4am stat with 6pm peak (Slide6NightOwl.tsx:35). clarify
[P2] Slide 7 duplicate 2.3h hero/average (Slide7DayHeatmap.tsx:181-184). distill
[P2] Double Back on /groups join and group page. distill
[P2] Not-found join error names recovery without a control (groups/page.tsx:179). harden
[P3] Card focus ring at rest on arrival (Slide10Share). polish
[P3] "Mostly Dark" ambiguity (Slide5BingeBeast). clarify
To 100: per-slide share/save, climax replay, desktop stage composition, "what friends see" preview, rename confirm, every error recovery a control.
