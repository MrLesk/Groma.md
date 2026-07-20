---
id: GROM-82
title: Filter bounded reads by component scale
status: To Do
assignee: []
created_date: '2026-07-20 18:19'
labels:
  - pivot
  - cli
  - application
milestone: m-5
dependencies:
  - GROM-71
priority: medium
type: feature
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GROM-71 gave components the closed scale axis and exposed it on every read surface. The bounded list surfaces should also filter by it so agents and humans can ask for one stratum directly: roots, children, list, and search accept an optional scale filter (and a shared filter), validated against the closed set, threaded through the exact option-shape validation in the application request contracts and the CLI flags, with help text. Semantic zoom in the web canvas (GROM-77) can then reuse the same filtered reads.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 List roots, children, components, and search accept optional scale and shared filters validated against the closed set
- [ ] #2 CLI list surfaces gain matching flags with help text, and filtered pages stay bounded with cursors intact
- [ ] #3 bun run check stays green
<!-- AC:END -->
