---
id: GROM-28
title: Build the reconstructable projection index
status: To Do
assignee: []
created_date: '2026-07-14 19:57'
updated_date: '2026-07-14 22:07'
labels: []
milestone: m-2
dependencies:
  - GROM-26
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Materialize canonical blueprint state into a disposable local index that can support fast search, joins, and graph traversal without becoming a second source of truth.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The index rebuilds deterministically from canonical intent and alias records and records the exact canonical generation it represents
- [ ] #2 Committed transaction events update indexed entities, adjacency, searchable text, and aliases without requiring a full rebuild
- [ ] #3 A missing event generation, stale generation, corrupt index, or absent index triggers a safe rebuild or an actionable unavailable diagnostic
- [ ] #4 Deleting or corrupting the projection cannot change canonical blueprint state
- [ ] #5 Index construction and updates remain behind a replaceable projection capability rather than leaking storage technology into Core
- [ ] #6 Tests prove rebuilt and incrementally updated indexes answer equivalent data for representative recursive graphs
<!-- AC:END -->
