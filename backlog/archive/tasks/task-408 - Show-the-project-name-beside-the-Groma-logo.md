---
id: TASK-408
title: Show the project name beside the Groma logo
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-15 17:27'
updated_date: '2026-09-15 17:34'
labels: []
dependencies: []
references:
  - web-page
  - render
modified_files:
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 454000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web map header currently shows the primary C4 system and counts beside the Groma lockup, but it does not identify the project profile that owns the map. Add the project title to the header so a reader can identify the project while navigating the architecture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Web header displays the current project profile title immediately beside the Groma logo when a project profile is available.
- [ ] #2 The project title refreshes when the live project profile changes, while the existing system name, counts, search, and controls remain available.
- [ ] #3 The header label is optional and does not disrupt the existing map layout; focused Web checks and bun run check pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a dedicated project-name element immediately after the Groma lockup in the Web header and style it with truncation consistent with the existing chrome.
2. Populate it from the existing project profile payload on initial render and after live world updates, while keeping system and C4 counts in their existing summary.
3. Verify the header in a local browser and run focused Web checks plus bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started after tracing the existing Web payload, page renderer, and live applyWorld path. The project profile is already present in WebBootPayload and refreshed with map updates, so no new data contract is needed.

The initialized map flow requires a valid project profile before it renders, so the task acceptance was kept focused on supported map behavior. Browser verification showed the project title beside the lockup, a temporary profile rename refreshed it live, and the existing system name and controls remained visible.
<!-- SECTION:NOTES:END -->
