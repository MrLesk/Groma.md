---
id: TASK-166
title: Move architecture surface labels outside their boundaries
status: Done
assignee:
  - '@codex'
created_date: '2026-08-24 18:10'
updated_date: '2026-09-13 15:13'
labels: []
dependencies:
  - TASK-165
references:
  - iso-projection
  - iso-map
  - layer-modes
  - sheet-composition
modified_files:
  - src/viewers/web/iso/project.ts
  - src/viewers/web/iso/text.ts
  - src/viewers/web/iso/paint-ground.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/layers/separation.ts
  - src/sheet/measure.ts
  - src/sheet/types.ts
  - test-bun/iso-map.test.ts
  - docs/viewers/web/index.md
priority: medium
type: enhancement
ordinal: 177000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After the blueprint sheet decorations are established, move system-island, group-zone, and container-slab names below or just outside their boundary lines. Use a short leader line where separation is needed, so names identify surfaces without sitting on their fills or competing with contained architecture. Preserve the existing isometric plane, selection behavior, camera fit, and the separate roof-label treatment for buildings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 System, group, and container names render below or just outside their own boundary instead of over the surface fill or pattern.
- [x] #2 A short leader line connects a separated label to its surface when needed, and representative nested maps remain readable without label-content overlap.
- [x] #3 External labels keep the surface plane alignment, selection and lit-state behavior, and the initial camera fit includes their visible bounds.
- [x] #4 Building roof labels remain distinct from surface labels, and focused tests plus browser QA cover the supported label flow.
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
1. Keep existing packed surface envelopes and reserve their front bands for external labels; draw each boundary above its label band.
2. Center surface labels and short leaders on the same plane in 2D and isometric views. Keep roof labels separate and preserve surface identity, highlights, and camera bounds.
3. Add focused geometry coverage for nested surfaces, projection, camera fit, and immutability; update the web viewer contract.
4. Run focused tests and bun run check, then verify the approved map flow in the browser and perform specification and quality reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused geometry checks pass in 2D and isometric views using the grouped plain-view fixture. Browser label clicks select the owning system and container, with matching boundary, text and leader highlights. Increased leader length from 10 to 20 plane pixels after fit-view inspection; the measured label band includes the leader and gap.

Verification: 42 focused tests passed across iso-map, sheet-scene, web-layer-mode, and web-map-presentation. The grouped plain-view fixture verifies external placement, centered plane alignment, separation from roofs and other labels, packed envelope bounds, fit at wide/tall viewports, and immutable sheet geometry in both views. Existing roof tests continue to pass.
Browser QA: approved Flow fixture preview and grouped plain-view fixture inspected in 2D and isometric views; labels and short leaders clear their own boundaries and nested content. Clicking external Service and API labels opens the correct details. Selected label text and leader use the same highlight. Selecting a flow preserves neutral ancestor surface labels and highlights the flow as before. No browser errors on grouped fixture. Screenshots: /tmp/groma-task-166-evidence/{2d,iso,grouped-2d,grouped-iso}.png. Preview: http://localhost:56377.
Full check: final bun run check passed (16 Node tests, 290 Bun tests, 6 existing skips; lint and types pass). The first full run timed out in scanner-settings-lifecycle source watching; that test passed alone. A clean archived baseline could not provide a comparable full run because ignored scanner build artifacts were absent. After the final leader-length change, the complete required check passed without changing scanner code, test assertions, timeouts, or retries.
Implementer specification and quality reviews passed. This is a bounded presentation change, so no separate architecture review was needed. Packing still reserves each complete envelope; projection separates its painted body from the label band; painting owns text, leader and hit area under the existing surface identity. No stored metadata or C4 hierarchy changes. The web viewer contract documents the final behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
System, container and group names now sit centered outside their own boundaries with short plane-aligned leaders. External labels select their owning surfaces and share selection and lit highlights; roof labels remain separate. Verified in 2D and isometric browsers, grouped geometry tests, and a passing bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
