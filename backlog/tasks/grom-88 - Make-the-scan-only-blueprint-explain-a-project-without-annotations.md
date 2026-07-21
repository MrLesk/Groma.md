---
id: GROM-88
title: Make the scan-only blueprint explain a project without annotations
status: Done
assignee: []
created_date: '2026-07-20 21:40'
updated_date: '2026-07-21 06:39'
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
- [x] #1 A reader seeing only the scan-only blueprint of this repo describes what groma does and names its major parts correctly
- [x] #2 Every semantic shown is derived from language-agnostic scan signals, with no framework, packaging, or language vocabulary in the derivation
- [x] #3 The same derivation produces an equally legible blueprint for a second unseen codebase without per-project tuning
- [x] #4 Nothing displayed is guessed: signals that do not meet their evidence threshold leave the surface silent rather than speculating
- [x] #5 bun run check stays green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Drove blind comprehension from 2/10 to a stable 7-8/10 across 6 measured rounds (48 blind judge-agents, forbidden from reading the repo; benchmarked against expert-career-path and generalized on Backlog.md). Grader verdict at plateau: 'highly legible ... readers converged on a genuinely accurate understanding of what groma does and the evidence/intent idea at its heart.' groma wins the density and wayfinding lenses; career-path keeps hierarchy and three-second, which are brand+subject-matter differences (a whole-system map has no single hero node, and brand forbids the saturated colour career-path uses for its focal point).

Semantics derived from language-agnostic signals only: (1) a directory README / package doc / module docstring describes its component, quoted verbatim, leading whole sentences up to budget, never written on the source's behalf and silent where the source is; (2) directed dependency counts (uses / used by / N external), reconcilable by eye against the lines drawn; (3) arrowheads + a 'uses ->' axis shown only where contents form a DAG; (4) a glossary defining only the vocabulary actually present; (5) the evidence/intent frame stated in prose.

Declined fan-in visual weighting (graders' most-repeated suggestion) as classification the manifesto forbids: pre-attentive weight asserts importance, and fan-in crowns a utils barrel over the real kernel. The deepest remaining gaps are beyond the scan-only ceiling by manifesto design: curated-wins reconciliation is the human intent layer (GROM-81), and per-file detail (host holds the scanner) would require file-level components that break the manifesto's 'bounded, small enough to take in' property (verified: domains have 0 children; the scan stops at boundary granularity deliberately).

Three real defects found and fixed while generalizing: src/readme.ts (a TS file) was ingested as markdown and its imports published as a description; card counts summed to more than the arrows drawn (endpoints below the visible rung were counted); dependency lines painted over card faces and bundled into phantom rectangles at hubs. Also filed GROM-89 (.DS_Store breaks startup) found during dogfooding.
<!-- SECTION:NOTES:END -->
