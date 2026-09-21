---
id: TASK-479
title: Use the breathing glow for focused flow highlights
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 21:12'
updated_date: '2026-09-21 21:21'
labels: []
dependencies: []
references:
  - map
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - docs/viewers/web/index.md
type: bug
ordinal: 555000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Flow steps still fade their highlighted map elements with the old opacity pulse, while clicking a component uses the newer breathing glow. Alex requests one consistent glow treatment everywhere the old map opacity pulse is used, keeping the architecture and its labels solid.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Focusing a flow step gives its highlighted endpoints and relationship the existing breathing glow treatment instead of fading their bodies or labels.
- [x] #2 Component selection and flow focus share the glow treatment; changing or clearing highlights, filtering, and switching Iso, 2D, or Layers keeps glows attached only to the displayed highlighted geometry.
- [x] #3 Reduced motion keeps steady emphasis, and the existing direction animation, selection, neighbor, task, and comparison behavior is preserved.
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
1. Reuse the existing map-owned cached glow for inspected components and focused flow endpoints/routes; keep each blurred shape on its own bounded HTML layer and derive it from the displayed projection. Remove the old map-flow-focus opacity animation and share the restrained border animation. 2. Preserve flow direction, neighbor/task/selection semantics, camera placement, and reduced motion. This is presentation in the existing map owner: no new OKF records, C4 concepts, or architecture geometry. It depends on projected shapes, not project language. 3. Existing web-map-highlights, web-flow-activation, and projection tests cover selection and flow membership. Add no decorative tests; directly verify solid bodies/labels, glow lifecycle, view changes, overlapping selection, and reduced motion in the browser using the flows fixture. 4. Update only the glow paragraphs in the web guide, preserving the embedding tasks. Run focused tests and bun run check, perform specification/quality review, then the requested full-context complexity review before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation and self-review: one map-owned glow cache now takes the union of inspected components and focused flow shapes, reuses overlapping highlights, and removes hidden or cleared shapes. Each halo keeps the existing static SVG blur on a bounded HTML opacity layer; solid bodies/text and directional route motion stay separate. No new domain concept or module. The old map-flow-focus fade and its redundant animation overrides are removed. Refactored the glow update into a small placement operation so changed functions meet the complexity limit. Specification and quality review traced flow/selection entry points through projected geometry and camera placement, checked reduced-motion CSS and highlight ownership, and found no remaining blocking issue. Verification: 37 focused tests passed; full bun run check passed (650 Bun tests, 38 skipped, no failures). On the flows fixture, browser DOM/computed-style checks verified three glows for a focused step, replacement when moving to an actor endpoint, Iso/2D/Layers geometry refresh, zero stale glows after filtering or clearing focus, retained lit routes after Clear focus, one halo per shape when component selection overlaps a focused flow, and the normal single-component glow with its direct neighbor. Reduced-motion emulation verified every outline/route/halo animation is disabled, halo opacity stays 0.55, and bodies/labels remain at opacity 1. Existing behavioral coverage is sufficient; no decorative tests were added.

Additional verification: all 16 Node tests passed in bun run check. Browser console reported no warnings or errors. The temporary browser viewport and reduced-motion override were restored, and the fixture server was stopped. Only the two glow-related documentation hunks are staged; the embedding/inset work remains outside this task.

Final full-context complexity review: no blocking findings or material simplifications. The reviewer confirmed that existing highlight classes lead through projected geometry to one cached halo per displayed shape, with shared cleanup and existing camera ownership. Keeping the small helpers in iso/map.ts and the shared animation in iso/style.ts is clearer than adding a separate module. No further architecture changes are needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the old focused-flow opacity pulse with the existing breathing glow for endpoints and routes. Selection and flow focus share one cached halo per displayed shape; bodies and labels stay solid, direction motion continues, and reduced motion stays steady. Updated the web guide. Verified with 37 focused tests, bun run check (16 Node tests and 650 Bun tests passed; 38 skipped), browser lifecycle/view/filter/overlap/reduced-motion checks, and the final complexity review.
<!-- SECTION:FINAL_SUMMARY:END -->
