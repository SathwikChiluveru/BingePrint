---
target: src/components/wrapped
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\Sathwik\\fun stuff\\BingePrint\\src\\components\\wrapped"
timestamp: 2026-10-21T12-45-33Z
slug: src-components-wrapped
---
Method: dual-agent (A: design review, live Playwright 390/1440/375x548 · B: CLI + browser metrics). Score 30/40 (75%).
Heuristics: 1:3 2:3 3:3 4:3 5:2 6:3 7:3 8:3 9:3 10:4
Detector: 0 findings, 3 design-system-font-size advisories (Slide8Personality.tsx:22, InviteFrame.tsx:27,35). No overflow, no console errors, 0 small targets on last slide.
[P1] Week chart bars misstate "twice as many" (~1.6x; ~1.4x short) — label in same flex column (Slide7DayHeatmap.tsx:206-231). polish
[P1] Personality stamp clips descenders ("g" in Binge) via background-clip + lh 0.92 (Slide8Personality.tsx:21-26,111-136). polish
[P1] Signed-out /groups Start my group: name form then 401 error, name lost (groups/page.tsx:255-268,379-381). onboard
[P2] Group page back only to My reel; /groups, group, compare, missing reel lack shared nav. layout
[P2] Duplicate compare links on group page; two share actions on compare. distill
[P3] short:line-clamp-1 truncates roast mid-word on card (ShareCard.tsx:144). adapt
