---
id: TASK-469
title: Clear component selection before selecting a system on the map
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 19:08'
updated_date: '2026-09-20 19:12'
labels: []
dependencies: []
references:
  - render
modified_files:
  - src/viewers/web/selection.ts
  - test-bun/web-selection.test.ts
  - src/viewers/web/render.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 545000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Large system surfaces cover most of the map, so clicking away from a component immediately selects its system instead of letting the developer clear the selection.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Given a selected component, when the developer plain-clicks an internal system on the map, architecture selection clears; clicking that system again selects it.
- [x] #2 Shift-click selection and selection through hierarchy, details and search retain their existing behavior; map clicks do not move the camera.
- [x] #3 The web interaction documentation describes the two-click behavior.
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
Keep this in the existing browser selection domain. Add a map-only selection reducer and route map-origin picks through it while keeping panel picks immediate. Use current selection rather than a new click counter. Preserve Shift-click, task/flow highlights and camera behavior. Test authority: the user requests component -> empty -> system on consecutive map clicks. Existing selection tests cover replacement and additive picks but not map context; extend that file with the two-click sequence and preserved panel/Shift-click behavior using an existing fixture. Update the web guide with the scenario, run focused tests and bun run check, perform implementer reviews and one full-context reviewer. This changes viewer state only, with no new OKF knowledge or C4 concepts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the rule in the existing pure browser selection module. The browser entry identifies map versus panel picks explicitly; no extra click state, timers, geometry changes or metadata were added. The regression failed before the rule (selected system instead of none), then all 10 focused selection/highlight tests passed. The full repository check passed: 16 Node tests; 623 Bun tests passed, 36 skipped, zero failures. Browser verification on an isolated relationship-pairs fixture exercised an actual exposed system polygon: component selected -> selection URL empty and Details closed -> same point selects system; camera transforms stayed unchanged. Shift-click retained both component and system; hierarchy selected system immediately. Temporary preview initially omitted the published version script; that harness route was corrected without product changes. Implementer specification and quality reviews passed: existing selection state owns the rule, ordinary picks are reused, task/flow state is preserved, regression assertions test behavior rather than prose. Final full-context review pending.

Final full-context complexity review: no blocking findings or recommended changes. Keep the selection-domain rule, explicit map/panel origin and existing generic reducer; no material deletion or collapse would simplify this further.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Plain map clicks on internal systems first clear a selected component; the next click selects the system. Shift-click and panel selection remain immediate, camera stays fixed, and active task/flow highlights are preserved. Verified by a regression that failed before the rule, 10 focused tests, actual browser interactions on an isolated fixture, and bun run check (16 Node + 623 Bun passing; 36 skips). Implementer and full-context complexity reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
