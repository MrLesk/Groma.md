---
id: GROM-58
title: Restore Groma self-blueprint readability after projection cleanup
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-19 14:59'
updated_date: '2026-07-19 15:00'
labels: []
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: bug
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bring the checked-in Groma self-blueprint transaction state onto the exact current journal schema so the current binary can read and query Groma itself. This repairs the repository-owned pre-release artifact without adding schema migration or permissive parsing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bare and blueprint read commands start successfully against Groma own checked-in workspace
- [x] #2 The transaction journal remains exact and fail-closed; no compatibility parser, migration layer, or fallback is added
- [x] #3 The checked-in state preserves generation and settlement evidence while removing only obsolete disposable-projection metadata
- [x] #4 Focused self-query verification and the repository check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the checked-in idle transaction journal with its exact current-schema encoding, preserving generation and settlement bytes semantically. 2. Use the source CLI to query Groma own blueprint and confirm bare startup no longer fails. 3. Run the full repository check, inspect the minimal diff, and publish one ready PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L1 bounded repository-state compatibility repair. The current exact journal parser is correct; the checked-in pre-release self-blueprint is stale after disposable projection metadata was removed. Supported boundary is this repository-owned idle journal only; no general migration or permissive legacy decoding is introduced.

Validation: source CLI blueprint export and search both read the checked-in self-blueprint at generation 102; bare Groma starts normally. bun run check passes with 386 tests plus formatting, types, boundaries, native build/smoke, and compiled crash-recovery verification.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed four obsolete disposable-projection fields from Groma checked-in idle transaction state while preserving generation 102 and the exact settlement. Added no parser fallback or migration path. Verified by querying Groma own blueprint and running the full repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
