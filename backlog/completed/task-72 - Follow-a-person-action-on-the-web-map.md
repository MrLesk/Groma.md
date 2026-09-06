---
id: TASK-72
title: Follow a person action on the web map
status: Done
assignee: []
created_date: '2026-08-16 20:39'
updated_date: '2026-08-16 20:50'
labels: []
dependencies: []
references:
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/render.ts
  - src/viewers/action-path.ts
documentation:
  - docs/viewers/web/index.md
priority: high
type: feature
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI lets an architect pick one person command and keep its path lit while they inspect boxes. groma web must do the same: a person's details list the launcher commands, clicking one lights that walk on the city, the path stays while other boxes are selected, and x clears it. Esc does not clear the path. No new Markdown or scanner change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a person command on web details lights that action path on the city immediately
- [x] #2 Selecting other boxes keeps the path; x clears it; clicking another person command replaces it
- [x] #3 Person details list launcher commands as pickable actions, matching the TUI
- [x] #4 Tests use a fixture world, not live groma/
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
1. Inspect person details with outgoingActions and mark launcher rows pickable.
2. Clicking a pickable row sets one activeActionId; x clears; other selection does not.
3. Dim off-path city routes and boxes; keep the current selection readable; label path routes; name the action in the footer.
4. Fixture-test inspect/pickable list. Browser-check the supported click-and-inspect flow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Web reuses outgoingActions/actionPath. Person outgoing rows are pickable. Click sets one activeActionId; select keeps it; x clears; another pick replaces. Off-path city routes and boxes dim; label planes keep transparent. Footer names the command.

Fixture: inspect-details lists api-web/api-jobs as pickable and a container as not; nextActiveActionId covers pick/select/replace/clear. bun test inspect-details and web-scene green. Viewer suite 49/49 before the last helper. Chrome MCP could not open a page (profile already running); served bundle contains pickAction/actionPath.

Quality blocker: setDimmed must not set transparent=false on depthWrite-false label planes. Fixed. Spec pass. Simplicity accepted after pathIds/opacity/test cuts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma web now follows a person command the same way as the TUI: click lights the path, other boxes keep it, x clears. Verified with fixture inspect and action-state tests. Interactive browser check was blocked by a locked Chrome profile.
<!-- SECTION:FINAL_SUMMARY:END -->
