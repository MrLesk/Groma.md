---
id: TASK-18
title: Deliver the Groma TUI viewer
status: To Do
assignee: []
created_date: '2026-08-01 22:50'
updated_date: '2026-08-01 22:50'
labels: []
milestone: m-3
dependencies: []
references:
  - groma/plans/05-tui-viewer/README.md
priority: high
type: feature
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect runs the Groma TUI in any terminal, Groma presents the same fixed, nested C4 world the browser viewer shows, navigated entirely from the keyboard across the four pre-configured levels — Context, Containers, Components, and Code — in the terminal's own theme colors. The whole application state is (level, selection): arrows move the selection world-first and escape boundaries by ascending, Enter descends or expands, Backspace ascends to the parent, and the camera is fully derived. The interaction, presentation, and shared-world-model requirements are Revision 05, confirmed by the human architect on 2026-08-01 through four feedback iterations on a live OpenTUI spike; the spike snapshot lives on branch `spike/groma-tui` (commit 8b786ed, with `DESIGN.md` learnings and `OPENTUI-NOTES.md` verified API notes) as reference only and is never merged. The production TUI is built fresh on OpenTUI over the shared world model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Running the TUI in a terminal presents the same architecture the browser viewer shows for the selected revision, at four discrete levels with no continuous zoom, no free pan, and no mouse interaction.
- [ ] #2 The application state is (level, selection) with the invariant that the selection is always a member of the current level's peer set; arrows select the nearest same-level peer in the pressed direction and, when none lies that way, escape the boundary to the nearest outer-level non-ancestor element, ascending to its level; arrows never descend.
- [ ] #3 Enter descends to the first child framed on the selection and, at the bottom of the ladder, opens the component detail pane (unclamped description, relationships, code items when present) which any key closes without acting; Backspace and Esc ascend selecting the parent; level jumps 1..4 anchor through the ancestor and first-child chains; Code stays honestly disabled while the model has no code observations.
- [ ] #4 No hardcoded colors: the terminal's default background and foreground plus semantic ANSI palette colors carry everything, emphasis renders as bold/normal/dim/hidden tiers from the shared emphasisAt weights, and a raw terminal capture of a full session contains no truecolor sequences from an owned palette.
- [ ] #5 Elements render at the representation-ladder rung their cell budget affords, floored at the titled box when the element's own C4 level is current; the focal system's Context identity is its emphasized folio header with no ASCII art; relationship label chips avoid occluding card text, boundary sub-labels, and each other.
- [ ] #6 The TUI consumes loadRevision, buildArchitectureModel, projectArchitectureMap, and the emphasisAt/levelAt/hasCodeLevel contract unmodified; whatever the projection kept private that the TUI needs is exposed from production, not duplicated; the browser viewer's checks stay green.
- [ ] #7 A headless verification suite drives the TUI through the full interaction and runs as part of the repository checks, with a real-terminal smoke test recorded as evidence.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
