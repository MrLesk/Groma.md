---
id: GROM-35
title: Define the finite observation-session contract
status: To Do
assignee: []
created_date: '2026-07-14 19:58'
labels: []
milestone: m-3
dependencies:
  - GROM-21
  - GROM-23
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give blind scanners a versioned, bounded way to report partial evidence and provenance without seeing the existing blueprint, choosing canonical identities, or mutating intent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The public contract represents session begin, bounded observation batches, heartbeat, completion, failure, source identity, project identity, declared scope, coverage, and provenance
- [ ] #2 Observations can report defensible subsets of component candidates, inputs, outputs, actions, relationships, and raw documentation evidence without completing a component
- [ ] #3 Observation keys are stable only within their declared source and scope and cannot be supplied as canonical component IDs or bindings
- [ ] #4 Contradictory records, invalid keys, undeclared scope, invalid provenance, stale epochs, and records after completion fail with stable diagnostics
- [ ] #5 A scanner receives project resources and configuration but no blueprint entities, curated intent, aliases, bindings, or reconciliation decisions
- [ ] #6 Contract tests cover large bounded batches, cancellation, heartbeat expiry, and partial contributions
<!-- AC:END -->
