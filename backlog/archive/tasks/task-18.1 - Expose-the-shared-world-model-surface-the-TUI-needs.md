---
id: TASK-18.1
title: Expose the shared world-model surface the TUI needs
status: To Do
assignee: []
created_date: '2026-08-01 22:50'
updated_date: '2026-08-01 22:50'
labels: []
milestone: m-3
dependencies: []
references:
  - groma/plans/05-tui-viewer/README.md
  - src/viewer/projection.mjs
parent_task_id: TASK-18
priority: high
type: feature
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI is a second renderer of the projected world, but the spike had to mirror projection internals because they are private: the zoom-derivation constants (reference margins, minimum adjacent-landmark ratio, absolute Components and Code landmarks) and the code items that never reach component nodes. Export the landmark-derivation surface from the production projection so a renderer with its own viewport can derive the four level scales with identical rules, and carry code items on projected component nodes so code chips and the detail pane can render them when the scanner provides observations. The browser viewer's behavior must not change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The projection exports the landmark-derivation rules (fit-derived Context and Containers, absolute Components and Code, minimum adjacent-ratio spacing, zoom-range bounds) so a caller with its own viewport derives the same four scales the browser viewer uses, without duplicating constants.
- [ ] #2 Projected component nodes carry their code items when the model has them, and the emphasisAt/levelAt/hasCodeLevel contract is unchanged for existing callers.
- [ ] #3 The browser viewer renders identically before and after: its node and e2e checks pass without modification.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
