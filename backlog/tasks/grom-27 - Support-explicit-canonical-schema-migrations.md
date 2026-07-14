---
id: GROM-27
title: Support explicit canonical schema migrations
status: To Do
assignee: []
created_date: '2026-07-14 19:57'
updated_date: '2026-07-14 20:37'
labels: []
milestone: m-4
dependencies:
  - GROM-21
  - GROM-23
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow canonical documents and plugin-owned records to evolve through explicit, previewable migrations instead of silently rewriting a workspace during ordinary reads or mutations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Groma reports the workspace schema floor, document versions, mixed-version state, and whether a complete migration path exists
- [ ] #2 A migration preview describes every canonical resource that would change and performs no writes
- [ ] #3 Applying a migration updates all affected resources transactionally and produces deterministic canonical output
- [ ] #4 Missing, ambiguous, incompatible, or failed migrators leave the workspace byte-for-byte unchanged with actionable diagnostics
- [ ] #5 Ordinary reads and mutations never perform an implicit schema migration
- [ ] #6 Supported older-workspace fixtures migrate and reload through public operations
<!-- AC:END -->
