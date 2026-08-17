---
id: TASK-81
title: Raise web map buildings sized by observed code weight
status: Done
assignee:
  - '@claude'
created_date: '2026-08-17 20:49'
updated_date: '2026-08-17 21:02'
labels: []
dependencies: []
priority: high
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web city draws every element as a flat slab, so a heavy component and a one-file helper look identical. Make leaf elements read like buildings: extrude each leaf box to a height derived from how much code its architecture Markdown observes through its code file references, so heavier components stand taller, and lay a quiet blueprint grid on the ground plane. Approved example: the reference demo where every building is a subsystem sized by its actual weight.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Leaf elements with observed code rise as buildings whose height grows with the amount of code behind them; elements without code references keep the current slab height
- [x] #2 The heaviest and lightest components of the observed world are visibly different heights
- [x] #3 The ground plane carries a quiet blueprint grid with no moire or vignette at fit, close zoom, plan view, and low orbit angles
- [x] #4 Routes, labels, selection outlines, and flow animation still attach correctly to raised buildings
- [x] #5 Height mapping is covered by a fixture test and bun test passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Compute each element's observed code size: in core.ts, after loading the annotated model, sum line counts of the element's unique code file references under the repository root into a new codeLines field on AnnotatedElement (0 without code).
2. In src/viewers/web/scene.ts, raise leaf prisms: height = kind base + 18 * sqrt(codeLines / max leaf codeLines of the world); leaves without code keep the kind base.
3. Add a quiet blueprint grid molecule under the city sized to the world bounds, geometric lines (no texture, no moire), very light ink, sitting just under the ground shadows.
4. Fixture test: heavier leaf yields a taller prism than a lighter one, no-code leaf keeps the base height; bunx tsc and bun test.
5. Verify in the browser at fit, close zoom, plan, and low orbit: heights differ visibly, grid stays calm, labels/routes/outlines/flow still attach.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
codeLines rides AnnotatedElement (optional; 0 when no code, unreadable file counts 0), attached in loadAnnotatedArchitecture by attachCodeLines reading each unique code file under the repo root. scene.ts raises leaf prisms by WEIGHT_RISE(18) * sqrt(lines / heaviest leaf lines); no-code leaves keep kind base. New molecules/grid.ts rules a geometric LineSegments survey grid (spacing 20, margin 40, z -0.3, renderOrder -2, no raycast) added by buildCity for non-empty worlds; gridLine color in theme. Verified in Chrome on port 4791: fit, 422% zoom (Navigation vs Tree heights clearly differ), Plan, low orbit (calm grid, no moire), and Runs-a-scan flow animating over raised buildings with touched outlines. Fixture test covers heavier>lighter>no-code and heaviest rise = WEIGHT_RISE. core.test expectations extended with codeLines. bunx tsc clean, bun test 145 pass.

Cold simplicity review: no accept-worthy findings; two comment-wording nits applied (codeLines doc comment, grid moire comment), placement observation recorded as-is. Post-nit verification: bunx tsc clean, bun test 145 pass twice in a row (one intermediate run had a single unrelated flake that did not reproduce).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Leaf buildings on the web map now rise with the code behind them: loadAnnotatedArchitecture weighs each element by the lines of its unique code files (codeLines on AnnotatedElement), buildScene adds WEIGHT_RISE * sqrt(lines / heaviest leaf) above the kind base, and a quiet vector survey grid (molecules/grid.ts) rules the sheet under the shadows. Verified with a fixture test (heavier > lighter > codeless, heaviest rises exactly WEIGHT_RISE), bunx tsc, bun test (145 pass), and Chrome checks at fit, 422% zoom, plan, and low orbit including an active flow animating over the raised buildings.
<!-- SECTION:FINAL_SUMMARY:END -->
