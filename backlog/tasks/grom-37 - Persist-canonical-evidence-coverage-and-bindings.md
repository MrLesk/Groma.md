---
id: GROM-37
title: Persist canonical evidence coverage and bindings
status: To Do
assignee: []
created_date: '2026-07-14 19:58'
updated_date: '2026-07-14 22:07'
labels: []
milestone: m-3
dependencies:
  - GROM-35
  - GROM-36
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the canonical evidence plane that preserves completed observations, provenance, coverage, and Groma-owned binding decisions separately from human- and agent-curated intent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Completed observations, provenance units, declared coverage, source ownership, and project identity persist as deterministic human-readable canonical records outside intent documents
- [ ] #2 Bindings represent automatic, explicit, ignored, and superseded decisions and resolve through component aliases
- [ ] #3 Evidence and binding generations reload after restart and can be reconstructed without volatile timestamps or process-specific paths
- [ ] #4 An unchanged completed snapshot produces no canonical byte churn and never rewrites curated intent files
- [ ] #5 Missing or unavailable source coverage preserves prior evidence and binding history instead of silently erasing architecture
- [ ] #6 The initial deterministic evidence sharding handles the documented 256-bucket strategy and reports evidence needed to evaluate later fanout changes
<!-- AC:END -->
