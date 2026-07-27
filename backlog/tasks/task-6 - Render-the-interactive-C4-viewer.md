---
id: TASK-6
title: Render the interactive C4 viewer
status: To Do
assignee: []
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 21:17'
labels: []
milestone: m-1
dependencies:
  - TASK-5
references:
  - README.md
  - groma/plans/02-live-viewer/README.md
  - 'https://c4model.com/'
  - 'https://reactflow.dev/'
priority: high
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create Groma’s first read-only local viewer from the C4 model delivered by TASK-5. The opening system-context view shows users and neighboring systems; selecting the focal Groma system reveals its runtime containers; selecting a container reveals its components. The Revision 02 architecture snapshot specifies a Bun-served React interface using React Flow for the node-and-edge canvas. This task renders one selected revision only; observed-versus-plan comparison and live reload are separate dependent tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The opening view shows people, the focal software system, connected external systems, and labeled directed relationships
- [ ] #2 Selecting the focal system replaces its single node with its containers while preserving connected context
- [ ] #3 Selecting a container reveals its components while collaborating containers and systems remain peers rather than becoming children
- [ ] #4 A user can return to the previous C4 level without changing any Markdown
- [ ] #5 The viewer persists no layout, focus, selection, or interaction state into groma/
<!-- AC:END -->
