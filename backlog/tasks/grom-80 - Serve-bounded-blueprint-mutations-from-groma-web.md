---
id: GROM-80
title: Serve bounded blueprint mutations from groma web
status: To Do
assignee: []
created_date: '2026-07-20 17:46'
labels:
  - pivot
  - web
milestone: m-5
dependencies:
  - GROM-70
priority: high
type: feature
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The loopback web server exposes the semantic mutations — create, update, move, merge, remove, accept — through the same shared application operations as the CLI, with expected-revision enforcement and structured diagnostics. Fail-closed semantics carry over intact: a delete or merge that would break referential meaning refuses and names its blockers, exactly like the CLI. Because a local server that accepts writes is a real attack surface, browser-facing write protection is part of the task: the server keeps binding 127.0.0.1 only and must reject cross-origin and DNS-rebinding requests by validating Origin and Host against the loopback listener. No UI in this task — API only, so the change stays reviewable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Mutation endpoints map one-to-one onto shared application operations with expected-revision enforcement and structured error diagnostics
- [ ] #2 Deletes and merges that would break referential meaning fail closed and name their blockers in the response
- [ ] #3 Cross-origin and DNS-rebinding requests are rejected via Origin and Host validation against the loopback listener, and the server still binds only 127.0.0.1
- [ ] #4 Semantic outcomes are equivalent to the CLI path for the same operations — one semantic path, no web-only meanings
- [ ] #5 A compiled black-box test drives one full mutate-and-reread cycle over HTTP and bun run check stays green
<!-- AC:END -->
