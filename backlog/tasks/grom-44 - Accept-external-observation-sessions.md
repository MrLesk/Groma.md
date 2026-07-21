---
id: GROM-44
title: Submit a completed external scan
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-21 18:02'
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
modified_files:
  - ARCHITECTURE.md
  - DEVELOPMENT.md
  - scripts/verify-binary.ts
  - src/application/reconciliation.ts
  - src/cli/contracts.ts
  - src/cli/help.ts
  - src/cli/parser.ts
  - src/cli/surface.ts
  - src/cli/tests/parser.test.ts
  - src/cli/tests/scan.test.ts
  - src/core/observation.ts
  - src/core/tests/observation.test.ts
  - src/host/contracts.ts
  - src/host/lifecycle.ts
  - src/host/scanner-runtime.ts
  - src/host/tests/scanner-runtime.test.ts
  - src/plugin-sdk/README.md
priority: medium
type: feature
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let an independent local scanner or agent submit one already-complete bounded observation snapshot through `groma scan --input`, using the existing observation contract and the same reconciliation path as the built-in scanner. The submission is atomic and local. It does not add streaming frames, heartbeats, provisional recovery, replay, remote transport, or a second evidence model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `groma scan --input <file|->` accepts one bounded `groma.observation/v1` completed snapshot from a file or standard input, independently of ordinary result formatting.
- [ ] #2 The snapshot is canonicalized through the existing finite observation-session contract, and its project, scopes, and scanner identity must match one registered local project and configured scanner.
- [ ] #3 A valid submission reaches the same reconciliation and canonical evidence path as a built-in scanner, including stable identity, intent preservation, unchanged byte stability, and indeterminate publication reporting.
- [ ] #4 Malformed, incomplete, unregistered, mismatched, ambiguous, cancelled-before-publication, or trailing input fails with stable diagnostics and leaves canonical state unchanged.
- [ ] #5 One concise SDK example and compiled end-to-end fixture prove an independent producer can submit evidence without loading project code, editing canonical files, or adding a transport framework.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the existing Core finite-session contract to canonicalize one completed snapshot, including exact-shape and bounded-record validation.
2. Add one atomic external-submit operation to the scanner runtime that validates project/scanner/scope registration and invokes the existing completed-snapshot consumer.
3. Extend scan with the existing structured --input/--stdin grammar and bounded result rendering.
4. Add focused Core/runtime/CLI coverage, concise producer documentation, and a compiled end-to-end fixture; preserve focused verification results and record the product-owner waiver of the remaining full/review gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope recut authorized for the fastest local-first vertical slice: the earlier framed-stream/heartbeat/failure transport criteria are superseded by one already-complete bounded local snapshot submitted atomically through the existing finite-session and reconciliation path. Streaming frames, durable heartbeat/recovery, replay, remote transport, and a parallel evidence model remain unsupported.

Implemented the authorized completed-snapshot slice: Core replays exact completed values through the finite-session contract; Host validates registered project/scanner/scopes and invokes the existing reconciliation consumer; CLI accepts file/stdin input; docs and compiled synthetic-producer coverage are included.

Focused validation completed before the override: 24 focused Core/Host/CLI tests passed; typecheck, architecture-boundary validation, formatting check, and git diff whitespace check passed. The full `bun run check` was started and then terminated immediately when Alex explicitly overrode remaining verification/review gates. Unverified by product-owner instruction. Acceptance criteria remain unchecked and the task remains In Progress; no review agents were spawned.

After the product-owner override, the task was moved to Done without checking the unverified acceptance criteria.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Product-owner verification override: merged without further local checks, CI wait, or review; acceptance criteria remain unchecked.
<!-- SECTION:FINAL_SUMMARY:END -->
