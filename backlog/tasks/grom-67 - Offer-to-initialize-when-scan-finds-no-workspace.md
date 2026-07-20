---
id: GROM-67
title: Offer to initialize when scan finds no workspace
status: To Do
assignee: []
created_date: '2026-07-20 06:07'
labels: []
dependencies: []
references:
  - src/cli/surface.ts
priority: medium
type: feature
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
groma scan in a directory without a groma workspace fails with a diagnostic that tells the user to run groma init first. In an interactive terminal that is a needless round trip: the CLI should ask whether to create the workspace now and, on yes, initialize and continue the same scan run. Non-interactive and json invocations keep the current fail-closed diagnostic so automation never creates a workspace implicitly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 groma scan with no workspace in an interactive plain-format terminal asks one yes-or-no question; yes initializes the workspace and the same invocation continues into the normal scan flow, no returns the existing workspace diagnostic without side effects
- [ ] #2 Non-interactive or json-format scan invocations never prompt and keep the current diagnostic; declining or an unreadable answer never initializes
- [ ] #3 The confirmation is injectable for tests; CLI tests cover accept, decline, and non-interactive paths, and the accepted path produces a completed scan in a fresh directory
- [ ] #4 Help text mentions that scan offers initialization in an interactive terminal
<!-- AC:END -->
