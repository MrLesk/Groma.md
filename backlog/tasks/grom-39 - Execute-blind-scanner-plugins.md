---
id: GROM-39
title: Execute blind scanner plugins
status: To Do
assignee: []
created_date: '2026-07-14 19:58'
labels: []
milestone: m-3
dependencies:
  - GROM-21
  - GROM-35
  - GROM-36
  - GROM-38
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run scanner plugins as finite, cancellable, scoped observation sessions while enforcing scanner blindness, lifecycle fencing, progress reporting, and safe failure semantics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The runtime starts enabled scanner capabilities with only their registered project resources, scanner configuration, declared scope, observation sink, and cancellation signal
- [ ] #2 Scanner execution maintains heartbeats, fences stale epochs, validates emitted scope, and exposes bounded progress and final status
- [ ] #3 A scanner process or plugin cannot receive the current blueprint, curated intent, bindings, aliases, or prior reconciliation results through the supported capability
- [ ] #4 Only a validated complete session is handed to reconciliation; cancellation, crash, timeout, and plugin failure preserve the prior committed architecture
- [ ] #5 Concurrent sessions for independent projects or sources remain isolated while conflicting sessions for one source and scope fail or supersede deterministically
- [ ] #6 Lifecycle and conformance tests cover in-process built-in scanners and the public third-party scanner capability
<!-- AC:END -->
