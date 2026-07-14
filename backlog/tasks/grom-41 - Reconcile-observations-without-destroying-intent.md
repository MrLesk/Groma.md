---
id: GROM-41
title: Reconcile observations without destroying intent
status: To Do
assignee: []
created_date: '2026-07-14 19:58'
labels: []
milestone: m-3
dependencies:
  - GROM-26
  - GROM-35
  - GROM-37
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Turn completed observation snapshots into stable automatic architecture and evidence updates while preserving curated meaning, explicit bindings, source ownership, and conceptual boundaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prior automatic bindings reuse stable canonical identity and otherwise deterministic automatic candidates are created from stable observation keys
- [ ] #2 Explicit, ignored, and superseded bindings are honored through aliases, while ambiguous matches surface candidates and fail closed instead of guessing
- [ ] #3 Reconciliation never overwrites curated intent or an explicitly pinned parent and never allows one source to remove evidence owned by another
- [ ] #4 Missing observations inside successfully declared coverage update explainable evidence state rather than deleting curated components
- [ ] #5 An identical completed snapshot is an idempotent no-op and every changed snapshot commits evidence, bindings, automatic entities, and projection notifications atomically
- [ ] #6 Tests cover overlapping scanner contributions, key migration, rename, disappearance, reappearance, partial coverage, ambiguous duplication, and prohibited regrouping
<!-- AC:END -->
