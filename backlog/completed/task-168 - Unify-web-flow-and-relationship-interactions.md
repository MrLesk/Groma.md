---
id: TASK-168
title: Unify web flow and relationship interactions
status: Done
assignee:
  - '@codex'
created_date: '2026-08-24 19:11'
updated_date: '2026-08-24 20:02'
labels: []
dependencies: []
references:
  - render
  - page
  - web-viewer
modified_files:
  - src/viewers/web/flow/row.ts
  - src/viewers/web/flow/list.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
  - test-bun/inspect-details.test.ts
  - test-bun/web-flow-selection.test.ts
  - docs/viewers/web/index.md
  - design-qa.md
ordinal: 179000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web architecture viewer currently presents flow activation and architecture navigation with overlapping visual language. Implement the approved generic Groma UI grammar in the hierarchy pane and right details sidebar: flow rows are toggles, relationships are peer navigation, actor commands are actor-scoped flows, and visual markers encode only Groma architecture kinds or interaction state rather than project-specific meaning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The hierarchy pane visually distinguishes flow toggles from structure navigation using only generic Groma markers
- [x] #2 The global Flows list and component Flows through list share the same flow-row interaction and active/selected language
- [x] #3 Actor Commands activate actor-scoped flows without being duplicated as architecture relationships or build information
- [x] #4 Architecture relationship rows always navigate to their peer and do not activate flows
- [x] #5 Flow controls expose their toggle state and relationship controls expose their destination to assistive technology
- [x] #6 Focused automated tests and browser verification cover component relationships, global flows, component flows through, and actor commands
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
1. Add one flow-domain row renderer whose FlowRef determines whether a row represents any scope or one exact actor scope; centralize active, selected, scope, and accessibility state there.
2. Split inspected details into peer relationships, actor commands, and flows through; render relationships as navigation only and move flow lists into What it does while keeping How it is built for technology and code only.
3. Apply the shared flow row to both the hierarchy Flows section and details sections, preserve TASK-165 shell changes, and update the minimal shared CSS and web-viewer documentation.
4. Update focused concurrent tests for classification and flow scope behavior, then run typecheck and the relevant viewer suites.
5. Compare the rendered implementation with the approved mockup in the in-app Browser, exercise global flows, component relationships, component Flows through, and actor Commands, then complete the required simplicity and quality reviews.

6. Apply the approved contextual-review cleanup: reuse the actor-command boundary, rename flow toggling terms, co-locate flow CSS, and remove obsolete CSS; then rerun focused and full checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the shared flow-row contract and split details into peer relationships, actor Commands, and component Flows through. How it is built now contains technology and code only. Typecheck and 24 focused action-path, details, flow-state, and URL tests pass.

Cold simplicity review removed unused relationship identity and element kind from the details projection and merged the duplicate inspected-flow shape into the shared FlowRowData domain type. The focused 16 tests and typecheck pass after cleanup.

Final verification after the subtraction pass: bun run check passed with 95 core tests, 180 viewer tests, and TypeScript noEmit. Browser verification at 1280x720 exercised component peer navigation, global flows, component Flows through, and actor Commands; URL state, pressed state, actor scope, and console state are recorded in design-qa.md. git diff --check passes.

Alex approved all four contextual architecture recommendations. The final cleanup now uses pickableActions as the actor-command authority, names flow state and callbacks as toggles, co-locates flow-row CSS under web/flow, and deletes the obsolete active-link rule. Focused 18 tests, typecheck, the full 95 core and 180 viewer tests, diff hygiene, and an in-app Browser reload pass after these changes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Unified web flow controls and relationship navigation across the hierarchy and details pane. Global flows, component Flows through, and actor Commands now share one domain-owned toggle row, while relationships select peers only. Verified with focused state/details/page tests, the full 275-test project check, and in-app Browser interaction and accessibility checks recorded in design-qa.md.
<!-- SECTION:FINAL_SUMMARY:END -->
