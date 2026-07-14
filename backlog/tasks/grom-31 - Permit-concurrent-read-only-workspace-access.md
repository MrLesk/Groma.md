---
id: GROM-31
title: Permit concurrent read-only workspace access
status: To Do
assignee: []
created_date: '2026-07-14 19:57'
updated_date: '2026-07-14 20:37'
labels: []
milestone: m-4
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
  - backlog/tasks/grom-20 - Dogfood-Groma-against-Backlog.md.md
priority: high
type: bug
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix the dogfood failure in which several independent read-only CLI processes can surface workspace-recovery-failed, so humans and multiple agents can inspect one blueprint concurrently without destabilizing it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A regression test reproduces concurrent reads from at least eight independent CLI processes against one initialized workspace
- [ ] #2 All concurrent read-only commands complete with deterministic valid results and none reports workspace-recovery-failed
- [ ] #3 Concurrent reads leave every canonical resource and the committed generation byte-for-byte unchanged
- [ ] #4 Writer exclusion, crash recovery, and stale-lock safety remain intact while readers are concurrent
- [ ] #5 The behavior is portable across the supported local-resource path and locking abstractions
<!-- AC:END -->
