---
id: TASK-240
title: Guide an empty project from groma view
status: To Do
assignee: []
created_date: '2026-09-02 20:59'
updated_date: '2026-09-02 21:17'
labels:
  - cli
  - tui
dependencies: []
ordinal: 269000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After `groma init`, a project has a profile and no architecture. When a human runs `groma view` there, Groma shows an empty state instead of a blank map: the project name, one line saying the architecture is empty, and the two ways forward: run `groma scan` to observe the code, or start a draft (the settled name for a plan, TASK-241 vocabulary: `groma add draft <name> --overview`, then `groma draft component <name> --parent <id>` for a ghost) when nothing is built yet. The empty state uses the terminal defaults and the brand green like the splash. It leaves when the world gains its first element: a scan that folds elements, or a refresh, replaces it with the map without restarting. The "no Groma directory" and "empty world" decisions live once in core (TASK-241.2 adds the seam for the browser); this task consumes that seam or adds it if it lands first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With a Groma directory and no architecture elements, `groma view` on a TTY shows the empty state with the project name, the empty line, and the exact `groma scan` and `groma create` commands, instead of a blank map
- [ ] #2 Escape, q and Ctrl+C leave the empty state; `r` refreshes it
- [ ] #3 When a scan or refresh yields the first element, the map replaces the empty state in the same process
- [ ] #4 `groma view --plain` and a non-TTY run print the same guidance as plain text
- [ ] #5 Tests cover the empty-state decision and the switch to the map through a fixture under test/fixtures
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
