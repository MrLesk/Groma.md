---
id: GROM-22
title: Load bootstrap workspace configuration
status: To Do
assignee: []
created_date: '2026-07-14 19:56'
labels: []
milestone: m-2
dependencies:
  - GROM-21
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let the official host discover a workspace and select runtime plugins before the full plugin graph exists, while keeping local filesystem and configuration-format assumptions replaceable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Phase 0 resolves replaceable resource, configuration-discovery, and configuration-parser capabilities into a typed workspace locator and base configuration
- [ ] #2 The official local profile loads the documented workspace configuration and requested runtime plugins without embedding its resource or parser technology in Core
- [ ] #3 Missing workspace, conflicting discovery results, malformed configuration, and ambiguous bootstrap providers produce distinct actionable diagnostics
- [ ] #4 Configuration discovery is deterministic across supported macOS, Linux, Windows x64, and Windows ARM64 path conventions
- [ ] #5 No project-provided runtime plugin executes before its configured package and trust requirements have been validated
<!-- AC:END -->
