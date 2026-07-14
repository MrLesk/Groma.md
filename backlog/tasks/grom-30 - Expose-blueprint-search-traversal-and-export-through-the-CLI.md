---
id: GROM-30
title: Expose blueprint search traversal and export through the CLI
status: To Do
assignee: []
created_date: '2026-07-14 19:57'
updated_date: '2026-07-14 22:36'
labels: []
milestone: m-2
dependencies:
  - GROM-29
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the detailed raw blueprint directly useful without AI by exposing the query engine through shared operations and deterministic human-readable and machine-readable CLI results. A 43-component, 83-relationship real-project baseline required repeated outgoing component-local reads because inbound and whole-graph queries were unavailable, while aggregate output omitted intent, actions, and relationships.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Shared application operations and the CLI expose component search, bounded traversal, inbound and outgoing relationships, and aggregate subgraph reads
- [ ] #2 A caller can export the complete current blueprint by consuming deterministic bounded pages without relying on the interactive terminal renderer
- [ ] #3 Plain and JSON results contain the same semantic data, include generation and continuation information, and preserve the one-bounded-result rule
- [ ] #4 Sparse and rich recursive components expose intent, inputs, outputs, actions, containment, and ordinary relationships in raw output
- [ ] #5 Fresh-process reads after restart return the same semantics and do not modify canonical state
- [ ] #6 CLI surfaces use shared query operations and cannot bypass projection generation checks
<!-- AC:END -->
