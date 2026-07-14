---
id: GROM-36
title: Persist and recover provisional observation sessions
status: To Do
assignee: []
created_date: '2026-07-14 19:58'
updated_date: '2026-07-14 22:07'
labels: []
milestone: m-3
dependencies:
  - GROM-35
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make scan execution crash-safe by journaling provisional sessions separately from canonical evidence and exposing only successfully completed snapshots to reconciliation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Provisional observations, session epoch, scope, coverage, heartbeats, and completion state survive process interruption without appearing as committed evidence
- [ ] #2 Only one valid completed snapshot per active epoch becomes eligible for reconciliation
- [ ] #3 Expired, superseded, failed, contradictory, and incomplete sessions are abandoned with actionable diagnostics and cannot imply missing evidence
- [ ] #4 Recovery after interruption exposes either the prior committed evidence or one complete newly reconciled result, never a partial scan
- [ ] #5 Session cleanup is deterministic and cannot delete canonical intent, prior completed evidence, or another source session
- [ ] #6 Crash and restart tests cover begin, batch append, heartbeat, completion, handoff, abandonment, and cleanup boundaries
<!-- AC:END -->
