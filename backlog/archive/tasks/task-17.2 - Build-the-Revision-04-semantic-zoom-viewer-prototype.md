---
id: TASK-17.2
title: Build the Revision 04 semantic-zoom viewer prototype
status: To Do
assignee: []
created_date: '2026-07-29 20:29'
updated_date: '2026-07-30 16:54'
labels: []
dependencies:
  - TASK-17.7
references:
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
parent_task_id: TASK-17
priority: high
type: feature
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
This task starts only after the approved candidate inventory, interaction proofs, survivor benchmarks, and selection task have recorded the winning library. When the human architect opens the local viewer and pans or zooms, Groma reproduces the approved fixed-world example: the software-system boundary and every nested card retain their world geometry while Context, Containers, and Components become primary globally at named landmarks. Build the viewer directly on the selected foundation, whether that means retaining React Flow or replacing it. Feed it the existing parsed Groma architecture model, focus on interaction and visual clarity, keep the prototype uncommitted, and add no dual renderer or migration layer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Opening the supported local viewer renders one selected Groma plan or the observed architecture at a time as a nested map from the existing architecture model; it does not overlay them.
- [ ] #2 Context, Containers, and Components are named landmarks on one continuous zoom range, and crossing a landmark changes visibility and emphasis globally without relayout or geometry jumps.
- [ ] #3 Wheel zoom, drag pan, plus, minus, and the slider operate the same camera; moving around the map preserves the current architecture level.
- [ ] #4 At every landmark, the primary cards keep the intended Groma card size, sharp text, sharp borders, and understandable relationship lines.
- [ ] #5 The already-supported plan selection and live reload flows continue to refresh the selected map; this task does not add another source mode or update mechanism.
- [ ] #6 The selected library becomes the single viewer rendering path without a compatibility adapter, dual renderer, or custom SVG, Canvas, or WebGL rendering engine.
- [ ] #7 The prototype includes no code-level zoom, canvas editing, saved camera state, arbitrary-repository layout system, hardening beyond reproduced scale evidence, or fallback renderer.
- [ ] #8 A local interactive preview is available for the human architect to evaluate, and no prototype change is committed before that approval.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dependency correction: the original task depended on a two-candidate G6/MSAGL spike. It now depends on TASK-17.7, which selects from the approved complete inventory and benchmark evidence.
<!-- SECTION:NOTES:END -->
