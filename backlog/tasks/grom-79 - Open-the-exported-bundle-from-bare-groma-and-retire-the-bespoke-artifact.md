---
id: GROM-79
title: Open the exported bundle from bare groma and retire the bespoke artifact
status: To Do
assignee: []
created_date: '2026-07-20 17:45'
labels:
  - pivot
  - cli
  - renderer
milestone: m-5
dependencies:
  - GROM-78
priority: medium
type: chore
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bare groma in an interactive terminal opens the exported bundle instead of the bespoke blueprint-html.ts artifact, ending the era of two hand-maintained renderers. The artifact renderer and its duplicated canvas, gesture, and branding code retire; its tests migrate to the bundle path. The manifesto surface promise holds: the local artifact stays non-mutating, network-free, and semantically equivalent to the terminal and web views. The Iteration 1A black-box pins exact CLI behavior and will need updating.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bare groma in an interactive terminal opens the exported bundle built from bounded shared reads
- [ ] #2 The blueprint-html.ts renderer and its duplicated gesture and branding code are removed, with tests migrated to the bundle path
- [ ] #3 The local artifact stays non-mutating and network-free, and terminal plus json fallbacks are unchanged
- [ ] #4 Iteration 1A black-box expectations are updated and green, and bun run check stays green
<!-- AC:END -->
