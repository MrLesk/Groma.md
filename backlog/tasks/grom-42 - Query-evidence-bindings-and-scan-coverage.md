---
id: GROM-42
title: Query evidence bindings and scan coverage
status: To Do
assignee: []
created_date: '2026-07-14 19:58'
labels: []
milestone: m-3
dependencies:
  - GROM-28
  - GROM-29
  - GROM-37
  - GROM-41
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the projection and query surfaces so raw Groma output explains what was observed, where it came from, how it is bound, and what remains uncertain without mixing evidence with intent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The projection indexes committed evidence, provenance, coverage, project and source identity, binding state, and derived current evidence state at an exact generation
- [ ] #2 Queries can filter and traverse by project, source, scanner, evidence state, confidence where supplied, binding state, component, and provenance location
- [ ] #3 Detailed component and subgraph results clearly distinguish curated intent from automatic candidates and supporting evidence
- [ ] #4 Evidence and binding queries are deterministic, bounded, cursor-aware, and equivalent after incremental update or complete projection rebuild
- [ ] #5 Missing, stale, ambiguous, ignored, and superseded evidence states are explainable through public results
- [ ] #6 Large evidence pages do not require loading the complete aggregate graph or all evidence shards
<!-- AC:END -->
