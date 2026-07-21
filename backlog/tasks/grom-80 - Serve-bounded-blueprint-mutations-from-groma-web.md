---
id: GROM-80
title: Serve bounded blueprint mutations from groma web
status: Done
assignee:
  - '@codex'
created_date: '2026-07-20 17:46'
updated_date: '2026-07-21 18:00'
labels:
  - pivot
  - web
milestone: m-5
dependencies:
  - GROM-70
modified_files:
  - DEVELOPMENT.md
  - scripts/verify-binary.ts
  - src/cli/help.ts
  - src/cli/instructions/curation.md
  - src/cli/instructions/overview.md
  - src/cli/instructions/reading.md
  - src/web/server.ts
  - src/web/tests/server.test.ts
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
- [x] #1 Mutation endpoints map one-to-one onto shared application operations with expected-revision enforcement and structured error diagnostics
- [x] #2 Deletes and merges that would break referential meaning fail closed and name their blockers in the response
- [x] #3 Cross-origin and DNS-rebinding requests are rejected via Origin and Host validation against the loopback listener, and the server still binds only 127.0.0.1
- [x] #4 Semantic outcomes are equivalent to the CLI path for the same operations — one semantic path, no web-only meanings
- [x] #5 A compiled black-box test drives one full mutate-and-reread cycle over HTTP and bun run check stays green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Refactor the loopback API dispatcher into explicit read and mutation routes while preserving every existing bounded read response.
2. Add five write endpoints that pass parsed request objects directly to createComponent, updateComponent, reparentComponent (the move operation), mergeComponent, and removeComponent; scale-proposal acceptance remains an ordinary update patch so there is no web-only semantic operation.
3. Enforce the actual listener authority on every API request and require the exact listener Origin on mutation requests; retain hostname 127.0.0.1 and bound request bodies.
4. Extend server route tests for all operation mappings, revision/conflict/blocker diagnostics, body/method failures, Host/Origin rejection, and loopback binding.
5. Extend the compiled binary smoke with a same-origin create-and-reread HTTP cycle, then run focused web tests, type/format/boundary checks, and bun run check; record only evidence-backed completion metadata.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented five POST routes under /api/component: create and update call their matching shared operations, move calls reparentComponent, and merge/remove call their matching shared operations. Scale-proposal acceptance remains the existing update operation with a scale patch, preserving one semantic path and avoiding web-only meaning. Parsed JSON is bounded to 256 KiB and application validation remains authoritative.

Write protection validates every API Host against the actual 127.0.0.1 listener authority, rejects a nonmatching Origin on every API request, and requires the exact listener Origin for mutation routes. The server continues to bind only 127.0.0.1. Shared operation outcomes are returned without translation, preserving content-revision conflicts and named merge/remove diagnostics.

Objective validation: focused src/web/tests/server.test.ts passed 9 tests / 54 assertions covering all five route mappings, update-as-scale-accept, conflict/blocker diagnostic preservation, invalid JSON/methods, hostile Origin, hostile Host, missing write Origin, and loopback URL. bun run check passed: formatting, TypeScript (server and web client), architecture boundaries, 491 tests / 3048 assertions, compiled native build and smoke with a real same-origin HTTP create-and-reread persistence cycle, and the complete Iteration 1A crash-recovery workflow. git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the protected loopback mutation API without a second semantic path: five bounded POST routes directly compose the existing shared component operations, including move via reparent and scale acceptance via update. Exact Host/Origin checks reject DNS-rebinding and cross-origin writes, while shared revision conflicts and fail-closed blocker diagnostics pass through unchanged. Updated shipped guidance and proved the result with focused HTTP route/security tests plus bun run check, including a compiled-binary create-and-reread cycle.
<!-- SECTION:FINAL_SUMMARY:END -->
