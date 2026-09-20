---
id: TASK-449
title: Make the empty web map a welcoming starting point
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 22:07'
updated_date: '2026-09-19 22:20'
labels: []
dependencies: []
references:
  - shell
  - settings-control
  - button
modified_files:
  - src/viewers/web/chrome/empty.ts
  - src/viewers/web/settings/control.ts
  - docs/viewers/web/index.md
  - src/viewers/web/atoms/settings-dialog.ts
  - design-qa.md
type: enhancement
ordinal: 521000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer can initialize Groma before adding any code. The current empty-map card says No component found and sends the developer to a terminal, making a normal starting state look like a failed scan. Use the approved card style to make this state clear and provide the existing scanner settings action in the browser.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An empty current map uses a calm welcome card with the project name, a concise next step, and the approved card styling.
- [x] #2 The live empty-map action opens the existing scanner settings dialog; published views do not offer an unavailable configuration action.
- [x] #3 Existing architecture keeps its compact dismissible notice, historical views stay hidden, and the welcome disappears when components arrive.
- [x] #4 Browser verification covers the empty-project screen and scanner action; documentation and bun run check pass.
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
1. Update the existing web empty-state card and its state-dependent copy without changing architecture meaning. 2. Connect its scanner action to the existing settings dialog and preserve live/static capabilities. 3. Verify the supported empty-project flow and existing visibility rules in the browser, update documentation and design QA, and run the repository check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated the full empty-map card to the approved startup-card style and a normal welcome message. The compact notice for existing architecture and historical/component visibility rules remain owned by the existing empty-state controller. Progress and stored architecture are unchanged; this UI has no new OKF concept or C4 element. No active task has overlapping files.

Connected Set up scanners to the existing Plugins dialog through its settings owner. The button is enabled only when the existing data source supports reading and changing scanners. Closing the dialog returns focus to the empty-state button.

Documented the empty-project welcome, the live-only scanner action, controller ownership, and the existing compact-notice behavior.

Browser verification confirms the welcome action, focus restoration, narrow and light/dark card layouts, compact notice state, and dismissal. Scoped the new clear-map-area positioning to the welcome card so the existing compact notice retains its prior placement.

Reproduced a focus defect in the new supported flow: after opening settings from the welcome, component arrival hides the invitation, and closing settings left focus on BODY. The existing dialog already returns to the Settings control when its opener disappears; its visibility check now also detects an opener hidden by its parent.

Final browser evidence proves AC1 with matched-size welcome captures and dark/light/narrow checks; AC2 with the working Plugins button, focus restoration, and a static export without the action; AC3 with live empty-to-system-to-component updates, dismissal, and an empty historical revision; AC4 with documentation and bun run check. The reproduced disappearing-opener focus defect now returns to settings-toggle, while the visible welcome button still regains focus. Final check: 16 Node and 611 Bun tests passed, 36 configured skips. Task-scoped whitespace checks passed. Specification and quality reviews found clear ownership and no blocking defect in the requested flow. This bounded UI change needs no additional modules, dependencies, or separate architecture reviews.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the empty-project failure message with a welcoming card consistent with startup, clear next-step text, and a live Set up scanners action. Reused Plugins settings and repaired focus restoration when the welcome disappears while the dialog is open. Preserved historical, published, compact-notice, and populated-map visibility behavior. Verified in the browser at matched screenshot size, narrow width, light/dark themes, and the normal map layout; bun run check passed 16 Node and 611 Bun tests with 36 configured skips. Updated web documentation and appended design QA evidence.
<!-- SECTION:FINAL_SUMMARY:END -->
