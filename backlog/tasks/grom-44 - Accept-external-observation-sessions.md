---
id: GROM-44
title: Accept external observation sessions
status: To Do
assignee: []
created_date: '2026-07-14 19:58'
updated_date: '2026-07-14 22:20'
labels: []
milestone: m-4
dependencies:
  - GROM-35
  - GROM-36
  - GROM-41
  - GROM-43
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: medium
type: feature
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let independent scanners, agents, and humans submit observations through the same safe finite-session boundary without editing canonical files or receiving a privileged mutation path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A versioned framed stream can submit begin, bounded observations, heartbeat, completion, and failure records from a file or standard input
- [ ] #2 The transport enforces the standard observation-session lifecycle, source identity, scope, provenance, epoch, and completion rules
- [ ] #3 Malformed, contradictory, stale, incomplete, and trailing records fail with stable diagnostics and cannot commit partial evidence
- [ ] #4 A valid external session reaches the same reconciliation and evidence path as a built-in scanner
- [ ] #5 The observation framing remains independent of ordinary CLI result formatting and is documented for third-party producers
- [ ] #6 The transport grammar is validated by a synthetic independent scanner, with resulting canonical evidence recorded in the current blueprint and existing canonical evidence preserved for the scheduled freeze decision
<!-- AC:END -->
