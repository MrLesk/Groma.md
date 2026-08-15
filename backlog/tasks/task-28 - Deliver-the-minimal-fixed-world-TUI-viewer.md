---
id: TASK-28
title: Deliver the minimal fixed-world TUI viewer
status: To Do
assignee: []
created_date: '2026-08-09 19:07'
updated_date: '2026-08-15 16:11'
labels: []
dependencies: []
references:
  - groma/plans/mvp/README.md
  - docs/viewer.md
  - docs/product-model.md
  - groma/README.md
priority: high
type: feature
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give the human architect a terminal interface for reviewing the annotated architecture returned by Groma core as one fixed nested world. The interface starts directly with `groma view`; a bare `groma` splash screen is outside this task. System Context, Containers, and Components are semantic zoom levels over the same coordinates, and the selected system or container determines what zooming inward reveals.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Running `groma view` opens the terminal viewer directly and requests its complete observed, missing, and every-plan model plus fixed-world ELK objects from Groma core
- [ ] #2 The viewer shows the core response as one fixed nested world with directed relationship arrows and never reads architecture Markdown or calculates layout itself
- [ ] #3 The header uses the standard `System Context` level name; the compact footer shows `- context | containers | components +`, emphasizes the current level, and lists applicable keys
- [ ] #4 `+` performs the same inward system-or-container transition as Enter without opening details; `-` selects the applicable parent and moves outward without opening or closing details
- [ ] #5 Arrow navigation can cross parent boundaries at the current level and escape to a higher level when no same-level destination exists
- [ ] #6 Enter opens an overlay side panel and frames as many direct children as possible without showing children of sibling containers; full-screen details hide the world
- [ ] #7 Observed, planned, and missing annotations are visible as compact chips, with terminal-theme-compatible presentation
- [ ] #8 Esc closes details and does not exit; Ctrl+C exits Groma and restores the terminal
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
- [ ] #5 TASK-28.3, TASK-28.1, and TASK-28.2 are Done with every acceptance criterion and task-specific Definition of Done item verified
- [ ] #6 The focused core-model, layout, rendering, navigation, detail, and lifecycle suites plus the project check command pass from a clean invocation
- [ ] #7 A real-terminal walkthrough records `groma view` startup, all three levels, selected-boundary drill-in, zoom-control focus, spatial navigation, annotations, overlay and full-screen details, camera reframing, resize, and exit
- [ ] #8 One final cold simplicity review confirms that no code, dependency, state, or test can be removed while preserving the accepted review flow
<!-- DOD:END -->
