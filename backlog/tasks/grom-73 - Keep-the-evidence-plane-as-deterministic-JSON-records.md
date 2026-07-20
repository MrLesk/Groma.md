---
id: GROM-73
title: Keep the evidence plane as deterministic JSON records
status: Done
assignee:
  - '@codex'
created_date: '2026-07-20 17:44'
updated_date: '2026-07-20 19:19'
labels:
  - pivot
  - persistence
milestone: m-5
dependencies:
  - GROM-70
priority: high
type: feature
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Evidence is machine data and stops pretending to be Markdown: today groma/evidence.md is roughly three thousand lines of JSON inside a code fence, unreadable and unreviewable. Evidence moves to plain deterministic JSON files under groma/, with stable ordering and bounded sharding so a routine rescan produces focused diffs (the git-churn risk named in the manifesto). Markdown remains the format for meaning — intent and plans; JSON becomes the honest format for observation records. Wording change is covered by the manifesto amendment (GROM-70); this task is the persistence change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Evidence persists as plain deterministic JSON under groma/ with stable key and array ordering, replacing the fenced JSON-in-Markdown file
- [x] #2 Evidence files stay bounded and sharded so a routine rescan yields focused reviewable diffs
- [x] #3 Write and read round-trips lose no evidence data and the intent plane is untouched
- [x] #4 bun run check stays green including the crash-recovery gates
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the transitional single evidence.json blob with a deterministic JSON evidence index and one bounded source shard per project/scanner source.
2. Extend reconciliation resource mapping and the local transaction adapter so the index and changed source shard participate in the same exact-revision atomic transaction as canonical intent changes.
3. Preserve temporary legacy evidence.md and transitional evidence.json reads without deleting either; explicit migration and removal remain GROM-74.
4. Add focused shard, byte-stability, legacy round-trip, and crash-safe integration coverage; update persistence documentation.
5. Run targeted suites, inspect the diff, then run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented deterministic v0.2 evidence index plus one bounded JSON shard per project/scanner source. Reconciliation now confirms exact index and source-shard revisions, and the transaction adapter commits both atomically with intent effects. Added persistence proofs for lossless round-trip, per-source diff locality, and shard bounds; retained temporary legacy/transitional reads for GROM-74.

Validation passed: targeted evidence/reconciliation/scan suites (30 tests), full bun run check (453 tests), architecture boundaries, native build and smoke, and the Iteration 1A crash-recovery workflow.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced fenced Markdown evidence with a deterministic v0.2 JSON index and bounded per-source shards. Reconciliation confirms and commits the index plus changed source shard atomically with intent effects, so routine rescans leave unrelated evidence byte-stable. Preserved temporary v0.1/transitional reads for the explicit GROM-74 migration. Verified with 453 tests and the complete compiled crash-recovery gate.
<!-- SECTION:FINAL_SUMMARY:END -->
