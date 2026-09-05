---
id: TASK-279
title: Preserve Web flow context and pulse the focused step
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 20:14'
updated_date: '2026-09-05 20:29'
labels: []
dependencies: []
references:
  - flow-controls
  - render
  - iso-map
modified_files:
  - features/flows.feature
  - src/viewers/web/flow/state.ts
  - src/viewers/web/flow/reader.ts
  - src/viewers/web/flow/row.ts
  - src/viewers/web/render.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - test-bun/web-flow-activation.test.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 318000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect opens a flow from component details, they can return to that component. Focusing a step keeps the entire authored flow highlighted and uses a continuous pulse to distinguish the current step, with a clear reader selection.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening a flow from component details provides a return action to the original component.
- [x] #2 Focusing or changing a step retains all authored flow routes and endpoints, and continuously pulses only the focused step without changing layout.
- [x] #3 The reader clearly identifies the focused step; endpoint inspection and return preserve the flow and step.
- [x] #4 Reduced-motion mode keeps a clear static focus marker; live, historical and static Web views share the same navigation behavior.
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
Keep flow navigation in the existing Web flow domain: remember the originating component, expose the shared Back control, and retain it through step and endpoint inspection. Derive full-flow highlighting separately from the focused relationship, reusing map route styling for a continuous pulse and static reduced-motion focus. Clarify reader focus controls, update the Web guide with the supported scenario, add focused navigation tests, verify in the browser, run bun run check, and obtain the full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused tests passed: 9 tests across flow activation and shared flow semantics. Browser verified component → flow → endpoint → same flow/step → original component, retaining all five route IDs and exact route coordinates. Next changes only the focused route; Clear focus keeps all five routes. Reduced-motion emulation disables both animations and keeps the stronger stroke. Own specification/quality review found no task-scoped blocker. The first repository check hit sandbox fs.watch EMFILE; the unsandboxed run passed lint/typechecking and Node tests but encountered two in-progress TASK-280 startup tests, whose recorded files do not overlap. No changes made to that task.

Final bun run check passed after TASK-280 completed: 105 Node tests and 310 Bun tests (415 total), with no added lint warnings. Browser checks used the shared renderer in read-only published delivery; live and historical delivery use the same flow navigation and map state functions. The full-context reviewer found no supported-flow defect or blocking complexity issue and recommended keeping the domain structure. Its one advisory recommendation is to derive full route membership directly from the resolved flow steps rather than call the step-aware shared helper; presented to Alex for the requested joint review decision before finalization.

Alex approved the reviewer recommendation. Full Web route membership now derives directly from the resolved authored steps, removing the repeated lookup and the step-aware helper import. Targeted re-review confirms focusedRoute remains independent and no navigation or geometry behavior changed.

After the approved simplification, bun run check passed again: 105 Node tests and 310 Bun tests, 415 total. git diff --check passed. The reviewer recommendation is resolved with Alex; no task-scoped blocking finding remains.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added return navigation from the flow reader to its originating component. The complete authored flow remains highlighted while one focused relationship pulses; the reader clearly marks that step and provides shared Previous, Next and Clear focus buttons. Reduced motion keeps static emphasis. Browser verification covered the component/flow/endpoint return path, unchanged route geometry, step changes and reduced motion. All 415 repository tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
