---
id: GROM-40
title: Scan TypeScript and Bun project architecture
status: To Do
assignee: []
created_date: '2026-07-14 19:58'
labels: []
milestone: m-3
dependencies:
  - GROM-23
  - GROM-34
  - GROM-39
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide the first deterministic built-in scanner that extracts a detailed, defensible architecture observation set from TypeScript and Bun projects without executing project code or inventing intent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The scanner discovers configured TypeScript and Bun workspace, package, and source boundaries and emits stable component candidates with exact provenance
- [ ] #2 It reports public exports as action candidates, cross-boundary imports as relationship candidates, Bun HTTP routes where statically defensible, and relevant documentation or comments as raw evidence
- [ ] #3 Generated, vendored, dependency, build-output, ignored, and out-of-scope resources are excluded according to explicit deterministic coverage rules
- [ ] #4 Observation keys and ordering remain stable across unchanged rescans and normalize supported macOS, Linux, Windows x64, and Windows ARM64 path conventions
- [ ] #5 The scanner never executes project code, reads a Groma blueprint, emits canonical IDs or bindings, or converts documentation into invented architectural intent
- [ ] #6 Scanner-level output passes the applicable automatic-blueprint benchmark assertions for Groma, Backlog.md, codex-hackathons, and the held-out fixture
<!-- AC:END -->
