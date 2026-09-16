---
id: TASK-270
title: Clarify task connections and animate flow dashes
status: Done
assignee:
  - codex
created_date: '2026-09-05 19:05'
updated_date: '2026-09-05 19:13'
labels: []
dependencies: []
references:
  - iso-map
documentation:
  - docs/viewers/web/index.md
  - docs/product-model.md
modified_files:
  - src/viewers/web/iso/paint-routes.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - docs/viewers/web/index.md
  - docs/product-model.md
type: enhancement
ordinal: 309000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect selects a task or flow in the Web map, Groma uses one clear line treatment: task-related connections are uniformly solid, while selected flow connections have clearly visible dashes moving from source toward destination with fixed arrowheads. Outside task/flow highlighting, draft relationships keep static dashes. Approved example: TASK-267 currently mixes dotted and solid task routes; selecting Agent: project setup currently shows small moving markers that are hard to see. Replace those treatments with the approved solid-task and moving-dash-flow design.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All task-highlighted routes use the same solid treatment, regardless of destination membership or draft/current origin.
- [x] #2 Selected flow lines use continuous moving dashes toward the destination, with fixed destination arrowheads and no moving marker; the selected flow retains existing route membership and step navigation.
- [x] #3 Outside task/flow highlighting, current routes remain solid and draft routes keep static dashes. Reduced-motion preference preserves the flow emphasis with animation disabled.
- [x] #4 Browser checks verify task uniformity, flow direction/movement and selection clearing without changing map geometry; documentation, required reviews and bun run check pass.
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
1. Keep route membership and selection ownership; remove the unused half state and moving marker. 2. Apply task-solid and flow-moving-dash styles with explicit precedence over draft styling, preserving reduced motion. 3. Verify supported browser states and geometry, update the two existing contracts, run repository checks and required reviews, and coordinate overlapping Safari performance work.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity review passed: removed half state and moving marker, with no new modules or animation lifecycle. Browser confirmed 28 TASK-267 highlighted routes are solid and static, seven project-setup routes use moving 8/5 dashes, marker nodes are gone, and route geometry is unchanged. Reduced-motion emulation stopped animation while preserving dashes. A restored-after-use browser style probe confirmed draft neutral 4/3 dashes, draft task solid, and draft flow 8/5 dashes. Existing flow/geometry checks passed 12 tests. First full check hit the existing scan-watch timing assertion; it passed in isolation. Next full check hit TASK-271 unfinished CLI lint, so final full verification runs against committed HEAD plus only TASK-270 code.

Final browser checks: Next isolates one animated route; All steps restores seven. Escape removes task/flow emphasis and all animations. Draft origin, task-solid, and flow-dash precedence were verified without retained browser mutations; reduced-motion override was reset. Source and destination route points remain unchanged; non-scaling SVG strokes keep dash lengths readable at fit. Visual capture: /tmp/groma270-flow.png. Implementer specification and quality reviews found all requested semantics present, with no new state, module, dependency, geometry change, or authority-backed blocker. TASK-269 independently owns the pre-existing Safari frame-rate issue; replacing the animation alone still measures roughly 27 FPS there and is not claimed as its performance fix.

Final full-context complexity review passed with no material recommendations. Final task-only bun run check passed: Biome and TypeScript completed, all 105 Node tests and 304 Bun tests passed. Seven pre-existing complexity warnings remain outside this change. Earlier retry had an unrelated terminal startup timeout; the final unchanged run passed. Verification log: /tmp/groma270-isolated-final.txt. All acceptance criteria and Definition of Done items are supported by the browser, test, documentation, and review evidence above.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Task-highlighted connections now use one solid treatment. Selected flow lines use moving dashes toward fixed destination arrowheads, replacing the separate moving markers. Neutral draft styles and reduced-motion behavior remain explicit. Existing route membership, step navigation, and map geometry are preserved. Browser verification, required reviews, and the full repository check passed. Safari animation performance is tracked separately in TASK-269.
<!-- SECTION:FINAL_SUMMARY:END -->
