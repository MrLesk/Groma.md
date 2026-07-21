---
id: GROM-97
title: Restore CLI scale-filter dependency boundary
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 18:28'
updated_date: '2026-07-21 18:39'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recent scale-filter work made the CLI import Standard Model directly, violating the declared architectural boundary and blocking the full check. Restore the intended composition without changing supported scale-filter behavior. Repair the text-based static-export verifier that misreads an inlined bundle as an external stylesheet without changing export behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI parser continues to accept the supported scale filters and rejects unsupported values
- [x] #2 CLI contracts and parser no longer import the Standard Model boundary directly
- [x] #3 The scale-filter behavior reuses an allowed contract or module rather than duplicating Standard Model validation
- [x] #4 bun run check:boundaries and bun run check pass
- [x] #5 Static-export verification inspects actual asset elements rather than text embedded in an inlined bundle
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Route CLI scale-filter typing and validation through the existing Application public facade, preserving parser acceptance and rejection behavior. 2. Replace text-pattern asset checks with one reusable structural HTML check used by both compiled verification paths. 3. Run focused parser/export checks, boundary/type checks, and the full check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented through the existing Application facade: parser behavior stays covered by focused CLI parser tests while check:boundaries prohibits the former CLI-to-Standard-Model dependency. Replaced false-positive text regexes with one HTMLRewriter-based external-asset check shared by compiled smoke and Iteration 1A verification. Validation passed: bun test src/cli/tests/parser.test.ts src/cli/tests/boundaries.test.ts src/cli/tests/export.test.ts; bun run format:check; bun run typecheck; bun run check:boundaries; bun run check (502 tests plus compiled Iteration 1A workflow). Two independent Terra xhigh reviews returned no findings. Claude was asked once as required but produced no output after several minutes; the single stalled request was stopped and not retried.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restored the CLI scale-filter dependency direction through the Application facade and made static-export verification inspect real asset elements. Verified with the full local check, including the compiled workflow.
<!-- SECTION:FINAL_SUMMARY:END -->
