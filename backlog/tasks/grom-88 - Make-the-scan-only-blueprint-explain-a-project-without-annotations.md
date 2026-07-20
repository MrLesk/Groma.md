---
id: GROM-88
title: Make the scan-only blueprint explain a project without annotations
status: In Progress
assignee: []
created_date: '2026-07-20 21:40'
updated_date: '2026-07-20 21:40'
labels:
  - pivot
  - web
  - scanner
milestone: m-5
dependencies: []
priority: high
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A first groma scan must produce a diagram from which a developer who has never seen the codebase can say what the project is and how it is built, with no human or AI annotation anywhere. Today the canvas shows correct structure but reads as a set of named boxes: the derived scale ladder, containment nesting, and dependency edges are all present, yet nothing on the sheet answers what the system does. Semantics must be derived from generic, language-agnostic scan signals only, never from TypeScript- or npm-specific vocabulary, and never guessed. Judged by whether independent readers describe the project correctly from the picture alone, benchmarked against the expert-career-path map for legibility and against Backlog.md as a second unseen codebase.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A reader seeing only the scan-only blueprint of this repo describes what groma does and names its major parts correctly
- [ ] #2 Every semantic shown is derived from language-agnostic scan signals, with no framework, packaging, or language vocabulary in the derivation
- [ ] #3 The same derivation produces an equally legible blueprint for a second unseen codebase without per-project tuning
- [ ] #4 Nothing displayed is guessed: signals that do not meet their evidence threshold leave the surface silent rather than speculating
- [ ] #5 bun run check stays green
<!-- AC:END -->
