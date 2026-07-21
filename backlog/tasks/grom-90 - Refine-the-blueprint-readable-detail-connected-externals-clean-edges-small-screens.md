---
id: GROM-90
title: >-
  Refine the blueprint: readable detail, connected externals, clean edges, small
  screens
status: In Progress
assignee: []
created_date: '2026-07-21 07:09'
updated_date: '2026-07-21 07:09'
labels:
  - pivot
  - web
milestone: m-5
dependencies: []
priority: high
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up on GROM-88 from user review of the running web blueprint. Five interaction and layout problems: (1) a reader could not easily open a component's detail — only the tiny name was clickable and the misleading 'Show parts' on a leaf domain loaded nothing; (2) the detail side panel left a grey desk-grid gutter beside it because the canvas reserved space for it; (3) borrowed dependencies were quarantined in one 'DEPENDS ON N EXTERNALS' box instead of being wired to the parts that use them; (4) dependency lines could cover the cards; (5) the surface did not adapt to small screens. Reference for the externals: dependencies drawn as their own nodes, connected to their consumer with a labelled edge, not boxed together.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The whole card opens the component detail, and a leaf component offers a clear 'Detail' affordance instead of a drill-down that loads nothing
- [x] #2 The detail panel is a solid opaque panel with no grey gutter beside it, and becomes a bottom sheet on small screens
- [x] #3 Borrowed dependencies are drawn as individual nodes wired to the parts that use them, placed beside those parts, not collected in a single box
- [x] #4 Dependency lines never paint over a card face, and the layout leaves channels for them to run in
- [x] #5 The header, notation key, and detail panel remain usable down to a 390px-wide viewport
- [x] #6 bun run check stays green
<!-- AC:END -->
