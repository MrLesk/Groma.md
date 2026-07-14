---
id: GROM-33
title: Verify and package the complete Iteration 1B foundation
status: To Do
assignee: []
created_date: '2026-07-14 19:57'
updated_date: '2026-07-14 20:38'
labels: []
milestone: m-2
dependencies:
  - GROM-21
  - GROM-23
  - GROM-32
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
  - DEVELOPMENT.md
priority: high
type: task
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Close Iteration 1B with black-box proof that the minimal capability runtime, configuration, public operations, bounded queries, deterministic export, recognition metadata, and canonical self-blueprint work together through the standalone distribution.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A clean checkout builds one standalone Groma executable and verifies bootstrap, configuration, public capability invocation, projection rebuild, bounded query, recognition metadata, and complete blueprint export through public surfaces
- [ ] #2 The canonical self-blueprint is validated against the architecture entry point and remains byte-stable across restart, index rebuild, and read-only use
- [ ] #3 Black-box cases cover malformed configuration, incompatible built-in capabilities, corrupt projection, stale cursors, and interrupted reads without unintended canonical changes
- [ ] #4 The quality gate cross-compiles exact standalone artifacts for macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64 from one runner
- [ ] #5 The host-compatible artifact runs the complete Iteration 1B workflow without a separately installed Bun runtime and documentation makes no unsupported native-runtime claim for other targets
- [ ] #6 Iteration 2 scanning, evidence, binding, reconciliation, and visual navigation remain clearly identified as not yet delivered
<!-- AC:END -->
