---
id: TASK-28.2
title: Navigate and inspect the fixed architecture world
status: To Do
assignee: []
created_date: '2026-08-09 19:07'
updated_date: '2026-08-09 20:03'
labels: []
dependencies:
  - TASK-28.1
references:
  - groma/plans/mvp/README.md
  - docs/viewer.md
  - docs/product-model.md
  - groma/README.md
parent_task_id: TASK-28
priority: high
type: feature
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let the human architect navigate and inspect the fixed world entirely from the keyboard after starting `groma view`. System Context is the outer level. The selected system or container determines which direct children are framed when moving inward. Global zoom, spatial selection, popup details, and camera framing never alter world geometry.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The viewer starts at System Context with the first internal system in stable-ID order selected; the footer calls this compact level `context`
- [ ] #2 `+` enters the selected internal system or container without opening details: a system frames only its containers and a container frames only its components; it is a no-op for people, external systems, components, or items without children
- [ ] #3 `-` returns from Components to the container whose children were framed, or from Containers to the system whose children were framed, without opening or closing details; it is a no-op at System Context
- [ ] #4 The footer continuously shows `- context | containers | components +` with the active level emphasized; `z` moves focus from the selected architecture item to this control, and pressing `z` again restores that item
- [ ] #5 With architecture focus active and no popup open, an arrow selects the nearest same-level item in that direction across the whole world, including an item under another parent, before considering a higher-level item
- [ ] #6 When no same-level item exists in the pressed direction, the arrow selects the nearest higher-level item outside the selected item ancestor chain and updates the level; arrows never descend and do nothing when no eligible destination exists
- [ ] #7 Enter performs the same applicable inward transition as `+` and opens the selected item details in an overlay right-side panel; if no inward transition applies, it only opens details
- [ ] #8 While the side panel is open, the camera fits as many direct children of the selected item as possible into the uncovered viewport without moving them or showing components from sibling containers
- [ ] #9 The detail popup shows name, kind, annotation chips, description, relationships, direct children, and component Code references when present; `f` toggles between side-panel and full-screen modes, and full-screen hides the world
- [ ] #10 Esc closes an open popup without changing level, selection, or geometry; Esc with no popup open exits Groma and restores the terminal
- [ ] #11 The bordered header and one-line footer update after every selection, level, focus, popup, and full-screen transition so the current item, level, focus, and applicable keys remain visible
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
- [ ] #5 Unit tests exercise stable initial selection, inward and outward transitions, items without children, zoom-control focus restoration, same-parent movement, cross-parent movement, higher-level escape, ancestor exclusion, and no eligible destination
- [ ] #6 Headless OpenTUI key sequences verify `+`, `-`, Enter, both `z` transitions, arrows, and unchanged world coordinates throughout
- [ ] #7 Headless detail tests cover a person, internal and external systems, a container, and a component; direct-child and Code-reference content; side-panel camera framing; sibling-container exclusion; `f`; and the two-step Esc sequence
- [ ] #8 Headless frames verify that side-panel mode overlays the world, full-screen mode hides it, and header/footer state and hints match every interaction state
- [ ] #9 The focused navigation/detail suite and project check command pass
- [ ] #10 A real-terminal walkthrough confirms selected-boundary drill-in, camera framing of a large container, zoom focus, cross-parent navigation, popup modes, and exit without a mouse
- [ ] #11 A cold simplicity review explains the keypress-state-camera-render path and removes any state, key binding, abstraction, or test not required by these acceptance criteria
<!-- DOD:END -->
