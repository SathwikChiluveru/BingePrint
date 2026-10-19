---
target: src/components/wrapped
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Sathwik\\fun stuff\\BingePrint\\src\\components\\wrapped"
timestamp: 2026-10-19T07-34-31Z
slug: src-components-wrapped
---
Method: dual-agent (source-only detector; no server). Score 28/40 (70%).
Heuristics: 1:3 2:3 3:3 4:3 5:3 6:2 (no group list) 7:2 (invitee ~7 taps, re-pitch) 8:3 9:3 10:3
Detector: 0 anti-patterns; Slide8 climax documented; InviteFrame sizes now documented.
[P1] Groups have no return path; new upload clears myGroup -> duplicate group. Fix: GET /api/groups my-groups list on landing,/groups,slide 10; keep group on stale reel with Update my stats. shape, harden
[P1] Invitee path re-pitches, three 'Prove it' meanings, sign-in return doesn't open form. distill, clarify
[P2] Slide 10 ending is a form, overflows 375x548. distill, animate
[P2] Timed exports inflate watchCount (raw rows). clarify
[P3] Slide10 regex bug (fixed), Watch my reel reopens slide 10, 'Your invite code' for friend's code. polish
