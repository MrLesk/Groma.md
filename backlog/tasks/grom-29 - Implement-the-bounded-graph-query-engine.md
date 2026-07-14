---
id: GROM-29
title: Implement the bounded graph query engine
status: To Do
assignee: []
created_date: '2026-07-14 19:57'
labels: []
milestone: m-2
dependencies:
  - GROM-28
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Answer useful architectural questions through deterministic pages and subgraphs so users and agents can explore a large blueprint without loading the entire graph.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Queries support exact entities, filtered component pages, full-text search, and relationship traversal by direction, type, and bounded depth
- [ ] #2 Every result is deterministically ordered, generation-aware, bounded by validated limits, and resumable with an opaque cursor
- [ ] #3 A cursor used against the wrong query or a changed generation fails with the documented cursor diagnostic
- [ ] #4 Inbound and outgoing relationships can be queried without reading every component document
- [ ] #5 Equivalent rebuilt and incrementally updated projections return semantically identical pages
- [ ] #6 The engine does not require callers or Core to know the projection storage technology
<!-- AC:END -->
