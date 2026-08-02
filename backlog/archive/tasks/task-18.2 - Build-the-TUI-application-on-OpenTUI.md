---
id: TASK-18.2
title: Build the TUI application on OpenTUI
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
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the production TUI on OpenTUI over the surface exposed by TASK-18.1: the (level, selection) state machine with world-first arrows and boundary escape, Enter/Backspace/Esc/1..4 with parent and first-child anchoring, the component detail pane, the representation ladder with the own-level floor, attribute-tier emphasis, theme-native colors, and the 750 ms level tween. The spike on branch `spike/groma-tui` is reference material — its `DESIGN.md` records the confirmed design and its `OPENTUI-NOTES.md` the verified library API — but the production TUI is written fresh in the production source tree, not merged from the branch. One piece of deliberately unfinished spike work becomes real here: relationship label chips need placement that avoids occluding card text, boundary sub-labels, and other chips.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The TUI implements the Revision 05 approved interaction completely: world-first arrows with boundary escape that ascends and never descends, Enter descend/expand with the detail pane, Backspace/Esc selecting the parent, 1..4 anchored jumps, breadcrumb, r reload preserving level and selection, ? help, and q restoring the terminal.
- [ ] #2 Rendering is theme-native (default background and foreground, semantic ANSI palette, bold/normal/dim/hidden emphasis tiers) with no hardcoded color anywhere, and the representation ladder floors elements of the current level at the titled box.
- [ ] #3 Relationship label chips are placed with collision avoidance: no chip occludes card text, a boundary sub-label, another chip, or is sliced by the selection frame in the shipped scenes.
- [ ] #4 The four level scales derive from the terminal viewport through the surface exported by TASK-18.1, with the cell grid's aspect corrected; terminal resize re-derives scales and preserves (level, selection).
- [ ] #5 The Code level stays honestly disabled without code observations and activates with them; the detail pane shows code items when present.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
