---
id: TASK-268
title: Animate shared flow trees in both Web panels
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 18:52'
updated_date: '2026-09-05 19:04'
labels: []
dependencies: []
references:
  - web-shell
  - flow-controls
  - web-viewer-details
  - render
modified_files:
  - src/viewers/web/chrome/motion.ts
  - src/viewers/web/organisms/sidebar-row.ts
  - src/viewers/web/organisms/sidebar-section.ts
  - src/viewers/web/organisms/hierarchy.ts
  - src/viewers/web/flow/list.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
  - src/viewers/web/flow/row.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 307000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use the same actor-grouped flow tree in the hierarchy and selected-element details panel, and animate disclosure rotation when groups or structure rows expand and collapse.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Chevron rotation is visibly animated when the user expands or collapses sidebar sections, actors, or structure rows, including after a repaint.
- [x] #2 The details panel uses the shared actor-grouped flow tree, counts, CSS branches and shortened labels, scoped to flows through the selected element.
- [x] #3 Folding in either panel preserves independent panel state and flow selection continues to open the correct reader; reduced-motion preferences are respected.
- [x] #4 Browser verification covers both panels and the repository check passes.
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
1. Reuse the flow-tree renderer with independent state per panel and a selected-element flow filter. 2. Animate changed disclosure states across existing repaints using the shared tree controls and motion settings. 3. Verify animation, both flow panels, selection and reduced motion; run bun run check and the final complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser verification passed in light and dark themes. Actor, structure, and section chevrons show intermediate rotation transforms while folding. Detail and sidebar fold state remain independent. Git details show one flow per actor while the sidebar shows six; selecting TypeScript scan opens its correct reader, and inspecting Git preserves the active flow and expanded detail actor. The shared reduced-motion guard skips animation, verified by a focused runtime check. The complete bun run check passed with 105 Node tests and 304 Bun tests, retaining seven existing lint warnings (log: /private/tmp/groma268-check-retry.log). The first sandbox run hit its watcher EMFILE limit; an unrestricted run hit the existing scan-watch timing failure, and the full retry passed without code changes. Implementer specification and quality reviews and the final full-context complexity review passed with no blocking findings or material simplification recommendations.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Animated shared CSS chevrons across tree repaints and reused the actor-grouped flow tree in selected-element details, with scoped counts and independent panel folding. Verified animation, reduced motion, flow selection, light/dark layouts, and the complete repository check (409 tests).
<!-- SECTION:FINAL_SUMMARY:END -->
