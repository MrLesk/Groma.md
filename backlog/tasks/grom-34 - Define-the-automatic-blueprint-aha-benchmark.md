---
id: GROM-34
title: Define the automatic-blueprint aha benchmark
status: To Do
assignee: []
created_date: '2026-07-14 19:58'
updated_date: '2026-07-14 22:36'
labels: []
milestone: m-3
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: task
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Turn the desired first-run experience into an evidence-based quality gate using Groma and a held-out TypeScript or Bun project, without requiring automatic output to reproduce curated domain names or prose. A manual real-project baseline contained 43 curated components, 83 relationships, and five roots; those metrics provide comparison context, while benchmark scoring remains limited to defensible observable facts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The benchmark separates defensible observable architecture from curated intent and never scores a scanner on invented business prose
- [ ] #2 Reference audits identify major observable project boundaries, public actions, cross-boundary dependencies, Bun routes where present, documentation evidence, and facts that must not be claimed for Groma and the held-out project
- [ ] #3 The scorecard measures false architectural claims, coverage of major observable facts, deterministic ordering, stable identity across rescans, provenance quality, time to first understandable visual, and unaided human comprehension of the main layer
- [ ] #4 Passing requires zero critical false architectural claims, complete coverage of the audited major workspace or package boundaries and their cross-boundary dependencies, and a bounded visual that exposes uncertainty rather than hiding it
- [ ] #5 Benchmark execution performs no AI calls, network inference, or human correction between scan start and scored output
- [ ] #6 At least one held-out TypeScript or Bun fixture is reserved from scanner-specific tuning and the documented groma init -> groma scan -> groma first-minute workflow is included in the evaluation
<!-- AC:END -->
