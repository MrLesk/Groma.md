---
id: TASK-479
title: Use the breathing glow for focused flow highlights
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 21:12'
updated_date: '2026-09-21 21:27'
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
Focused flow components used the old opacity pulse while clicking a component used the breathing glow. Components should share the glow. Relationship lines should show only directional motion, without a glow or opacity pulse.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Focused flow components use the same breathing glow as component selection, while their bodies and labels remain solid.
- [x] #2 Relationship lines show only their directional motion: no glow, opacity pulse, or border-color animation.
- [x] #3 Highlight cleanup, overlapping component selection, view changes, filtering, and reduced motion continue to work.
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
1. Keep the shared cached glow only for highlighted component shapes. Relationship lines retain directional motion only; remove their added glow and border animation and the old opacity pulse. 2. Correct the two glow paragraphs in the web guide and preserve other agents work. No OKF or C4 changes: this remains map presentation. 3. Use existing behavioral coverage and browser checks of component glows, direction-only relationship lines, and reduced motion; no decorative tests. Run bun run check, then self-review and the requested full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation and self-review: one map-owned glow cache now takes the union of inspected components and focused flow shapes, reuses overlapping highlights, and removes hidden or cleared shapes. Each halo keeps the existing static SVG blur on a bounded HTML opacity layer; solid bodies/text and directional route motion stay separate. No new domain concept or module. The old map-flow-focus fade and its redundant animation overrides are removed. Refactored the glow update into a small placement operation so changed functions meet the complexity limit. Specification and quality review traced flow/selection entry points through projected geometry and camera placement, checked reduced-motion CSS and highlight ownership, and found no remaining blocking issue. Verification: 37 focused tests passed; full bun run check passed (650 Bun tests, 38 skipped, no failures). On the flows fixture, browser DOM/computed-style checks verified three glows for a focused step, replacement when moving to an actor endpoint, Iso/2D/Layers geometry refresh, zero stale glows after filtering or clearing focus, retained lit routes after Clear focus, one halo per shape when component selection overlaps a focused flow, and the normal single-component glow with its direct neighbor. Reduced-motion emulation verified every outline/route/halo animation is disabled, halo opacity stays 0.55, and bodies/labels remain at opacity 1. Existing behavioral coverage is sufficient; no decorative tests were added.

Additional verification: all 16 Node tests passed in bun run check. Browser console reported no warnings or errors. The temporary browser viewport and reduced-motion override were restored, and the fixture server was stopped. Only the two glow-related documentation hunks are staged; the embedding/inset work remains outside this task.

Final full-context complexity review: no blocking findings or material simplifications. The reviewer confirmed that existing highlight classes lead through projected geometry to one cached halo per displayed shape, with shared cleanup and existing camera ownership. Keeping the small helpers in iso/map.ts and the shared animation in iso/style.ts is clearer than adding a separate module. No further architecture changes are needed.

Scope correction from Alex: the request was about components, not relationship lines. I incorrectly expanded the scope and wrote acceptance criteria that included routes. Reopening this task to remove the added route glow and border animation and restore relationship rendering to its pre-task behavior.

Alex clarified the final relationship treatment: lines need only directional motion, with no opacity pulse. This supersedes the previous correction plan to restore the original line opacity animation.

Corrected implementation and self-review: removed route lookup, polyline/lift drawing, and the line/shape switch from the glow renderer. The glow candidate selector now names only architecture bodies. Relationship lines use only map-flow (dash movement); their groups and strokes remain at opacity 1 and have no border-color animation. Browser verification on the flow fixture found exactly two halos (worker and entry), solid component bodies, route group animation none, line animation map-flow, and changing dash offsets while opacity stayed 1. Reduced-motion emulation disabled the halos and line movement with stable opacity; clearing focus removed both halos while the checked-flow lines continued directional motion. The targeted specification/quality re-review matched these results to the corrected request and found no remaining defect or added responsibility.

Final correction verification: bun run check passed again after the direction-only line change (16 Node tests and 650 Bun tests passed, 38 skipped, no failures). Browser console had no warnings or errors. No tests or public APIs were added.

Final full-context complexity review found no blocking issue. Accepted its narrow simplification: remove the extra stacking-order change so component glow layers stay behind relationship lines. The renderer now accepts only body polygons and no line/shape mode. Ownership remains in the existing map renderer/styles with no new abstraction.

The final bun run check passed after preserving the original halo layer order: 16 Node tests and 650 Bun tests passed, 38 skipped, zero failures. Final scope: component glow, direction-only relationship lines. The rejected route-glow behavior from the first delivery is removed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Focused flow components share the component-selection breathing glow, with solid bodies and labels. Relationship lines only move along their direction; they have no glow, opacity pulse, or border-color animation. Removed route-specific glow geometry and drawing, kept halos behind the lines, and corrected the web guide. Browser checks verified two component halos, direction-only opaque lines, reduced motion, and cleanup. bun run check passed (16 Node tests and 650 Bun tests; 38 skipped). The targeted full-context complexity review found no blocking issues.
<!-- SECTION:FINAL_SUMMARY:END -->
