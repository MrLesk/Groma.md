---
id: GROM-75
title: Report structural scale signals from blind scanners
status: To Do
assignee: []
created_date: '2026-07-20 17:45'
labels:
  - pivot
  - scanner
  - plugin-sdk
milestone: m-5
dependencies:
  - GROM-70
priority: high
type: feature
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scanners measure, never classify: deciding whether something is a domain or a part is judgment, and judgment is intent. The plugin SDK evidence contract gains deterministic structural signals that are objective, countable, and blind — subtree size (files, exports), declared-boundary markers (package manifests, workspace roots, project references), entry-point markers (bins, served routes), and reuse breadth (imported by how many distinct sibling subtrees). The built-in TypeScript scanner emits them. As part of this, source-boundary demotes from a projected component type to a boundary-marker signal: it always named how a thing was found, not what it is. No scale vocabulary appears anywhere in the SDK.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The plugin SDK evidence contract defines the structural signal fields with deterministic semantics and no scale vocabulary
- [ ] #2 The built-in TypeScript scanner emits the signals, and the same source tree yields identical signal output across runs
- [ ] #3 The scanner stops projecting source-boundary as a component type; the observation persists as a declared-boundary signal without identity churn for existing observed components
- [ ] #4 Scanners remain blind: no blueprint access is added anywhere on the signal path
- [ ] #5 bun run check stays green
<!-- AC:END -->
