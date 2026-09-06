---
id: TASK-138
title: Flip a task badge once when it becomes Done
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 14:15'
updated_date: '2026-08-23 14:26'
labels: []
dependencies: []
references:
  - render
  - backlog-plugin
modified_files:
  - src/viewers/web/work/badge.ts
  - src/viewers/web/work/pins.ts
  - src/viewers/web/work/island.ts
  - test-bun/work-badge.test.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 149000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an existing Live work task changes from a nonterminal status to Done, its visible work badges should visibly complete their existing card flip into the checkmark. The transition should announce the state change once without replaying for tasks already Done on first load or for later unchanged updates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When a mapped task changes from a nonterminal status to the configured final status, each existing visible map pin flips once from its front mark into the Done checkmark
- [x] #2 When the Live work island is open, each visible chip for that task performs the same one-time flip into the Done checkmark
- [x] #3 Tasks already Done on the first paint start on the checkmark without animating, and later updates that keep them Done do not replay the flip
- [x] #4 Filtering, arrival bounce, hover, activation, selection and details behavior remain unchanged
- [x] #5 Focused lifecycle tests and rendered browser verification cover the one-time Done transition
- [x] #6 A badge that was visible before completion remains visible only through the flip, then follows the current Done filter; a filtered-out task is not surfaced just to animate
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
1. Keep terminal detection in WorkPin and the existing work domain; do not add another task lifecycle model.
2. Let the shared work-badge atom own the front/checkmark state, a pure false-to-true transition detector and one 500 ms finish keyframe. Apply the same badge state classes from pins and chips.
3. Each UI owner remembers only active finishing keys. A badge visible before completion temporarily bypasses the new Done filter through the flip, then the current filter takes effect; hidden work stays hidden. Existing Done work paints its final face without animation and unchanged updates do not replay.
4. Add focused pure transition tests, document the shared visual behavior, and verify pins and chips through the live browser flow.
5. Run full checks and the required cold and full-context complexity reviews before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one shared WorkPin false-to-true terminal detector and one shared 500 ms badge keyframe. Map pins and open-island chips retain only badges that were visible before completion; each owner releases that transient visibility after the flip so the current Done filter applies. The island keeps separate finishing and animating sets because one retains visibility and the other prevents rebuilds from replaying the animation. Validation: focused 13-test work/live set passed; TypeScript passed; clean-index full suite passed with 92 Node and 145 Bun tests. Rendered Playwright QA at 1440x900 observed one pin and chip before completion, both running work-badge-finish during completion, and neither visible after 650 ms with Done disabled; no console warnings or errors. The in-app Browser runtime could not start because node:process imports are blocked, so the previously approved Playwright fallback was used. Cold simplicity and full-context architecture reviews reported no findings and recommended no further abstraction.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added one shared Done transition to the Live work badge so an existing visible map pin and open-island chip flip once into the checkmark, stay visible only through the animation, then follow the current Done filter. Initial or unchanged Done work does not animate, and hidden work does not surface. Verified by pure lifecycle tests, TypeScript, the complete 92 Node plus 145 Bun clean-index suite, rendered Playwright timing checks, and two no-finding architecture reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
