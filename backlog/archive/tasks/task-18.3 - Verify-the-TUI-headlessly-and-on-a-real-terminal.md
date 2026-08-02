---
id: TASK-18.3
title: Verify the TUI headlessly and on a real terminal
status: To Do
assignee: []
created_date: '2026-08-01 22:50'
updated_date: '2026-08-02 17:17'
labels: []
milestone: m-3
dependencies: []
references:
  - groma/plans/05-tui-viewer/README.md
parent_task_id: TASK-18
priority: high
type: feature
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The spike proved a verification pattern worth keeping: OpenTUI's headless testing renderer exposes the authoritative cell grid — characters, per-cell color intent, and attributes — so interaction and rendering assert without a terminal emulator, while a scripted real-terminal session audits the actual escape sequences on the wire. Turn that pattern into a repository-integrated suite for the production TUI: drive the full approved interaction headlessly, assert the state-machine invariant and the ladder per-cell, audit a full session's raw output for theme-native color discipline, and smoke-test a real terminal session end to end.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A headless suite drives arrows (including boundary escapes), Enter/Backspace/Esc, level jumps, the detail pane, reload, resize, and quit, asserting the (level, selection) invariant and the derived camera after every transition.
- [ ] #2 Per-cell assertions cover the representation ladder at each level, the own-level floor, the selection frame, emphasis tiers, and label-chip collision avoidance.
- [ ] #3 A scripted real-terminal session's raw output contains only default and palette-indexed colors plus bold/dim — no truecolor from an owned palette — and the session exits with the terminal restored.
- [ ] #4 The suite runs as part of the repository checks and fails the build on regression.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
