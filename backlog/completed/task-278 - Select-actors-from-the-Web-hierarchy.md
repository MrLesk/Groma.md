---
id: TASK-278
title: Select actors from the Web hierarchy
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 20:06'
updated_date: '2026-09-05 20:14'
labels: []
dependencies: []
references:
  - flow-controls
  - render
  - web-viewer-details
  - hierarchy
  - page
modified_files:
  - src/viewers/web/flow/list.ts
  - src/viewers/web/render.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/organisms/hierarchy.ts
  - docs/viewers/web/index.md
  - src/viewers/web/page.ts
type: enhancement
ordinal: 317000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Show Actors as the first hierarchy section. Actor arrows expand their authored flows, while actor rows select the actor and open its details like software rows. Simplify Structure by listing internal systems directly and retaining the External systems label.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The hierarchy shows Actors; clicking an actor selects it in the shared map/details state and marks its row without changing its fold state.
- [x] #2 Actor arrows only expand or collapse their flow children; flow selection and separate details-panel folding keep working.
- [x] #3 Structure no longer has a redundant Systems heading, while External systems stays clearly separated.
- [x] #4 Hovering section or row chevrons in either panel shows the Groma highlight color and pointer cursor.
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
Add actor selection to the existing shared flow tree and pass named pane options from the renderer. Reuse normal selection styling and arrow handling. Remove only the internal Systems label, update interaction documentation, verify selection and folding in the browser, run the repository check and final review.

Apply the same chevron hover highlight and pointer cursor to section headings and nested rows in both panels, then verify actual pointer hover.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser verification: clicking Coding agent selected its map and sidebar marks, set actor=coding-agent in the URL, and opened its details without expanding the group. Expanding Human architect retained Coding agent selection; selecting Human architect retained its open group. Details folding remained independent, and selecting the TypeScript scan child opened the flow reader while preserving sidebar expansion. Structure directly lists Groma and retains External systems. Actual mouse hover on section and row chevrons in both panels produced the Groma accent rgb(20, 122, 89) and pointer cursor. Final bun run check passed: 105 Node and 306 Bun tests; seven existing lint warnings. A sandboxed attempt failed with EMFILE in a filesystem watcher; the unrestricted required check passed. Implementer specification and quality reviews passed. Full-context actor_selection_review found no blocking issues or material simplifications; the final hover CSS uses one shared rule. Documentation describes the delivered interactions.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Actors in the hierarchy now select through the shared map/details state, while arrows independently expand their flows. Structure lists internal systems directly. Both panels use the Groma accent and pointer on chevron hover. Verified the supported interactions in the browser and passed all 411 repository tests and the complexity review.
<!-- SECTION:FINAL_SUMMARY:END -->
