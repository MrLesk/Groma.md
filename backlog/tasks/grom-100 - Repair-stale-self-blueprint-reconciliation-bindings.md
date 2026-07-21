---
id: GROM-100
title: Repair stale self-blueprint reconciliation bindings
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-21 18:39'
updated_date: '2026-07-21 18:48'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Restore Groma's checked-in self-blueprint so the public init -> scan -> groma loop can reconcile current source evidence after previously observed source files were removed. The repair must use supported Groma operations, preserve curated architectural intent and stable opaque identities, and keep ambiguous or missing bindings fail-closed. The committed canonical evidence should be immediately reusable by the visual blueprint work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A fresh public Groma self-scan completes successfully on the current repository instead of failing with reconciliation-binding-missing for removed source evidence
- [ ] #2 The repair preserves curated component intent and stable canonical identities while updating or retiring stale scanner-owned evidence only through supported semantic operations
- [ ] #3 Two consecutive self-scans produce deterministic byte-stable canonical state and a bounded blueprint consumable by the existing visual surface
- [ ] #4 Focused reconciliation coverage and the complete repository quality gate pass without weakening ambiguity handling
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce the stale-binding failure and compare current canonical entities/relations with retained scanner bindings. 2. When canonical target state is already absent, retire only a dangling component or relationship binding that the current successful snapshot does not contain; keep a present conflicting observation fail-closed and leave live canonical targets under existing partial-coverage preservation. 3. Add focused component and relationship regressions proving omitted dangling bindings retire, present conflicts still fail, and repeats are byte-stable under partial and complete coverage. 4. Run the public self-scan twice, inspect the operation-produced canonical diff and visual export, then run the complete quality gate. 5. Complete exactly two Terra xhigh reviews and one Claude review, resolve justified findings, create one ready PR, handle the first Codex review and green CI, then merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter L2 trace: pre-repair canonical state had 93 components and 278 relationships. Exactly one retained component binding pointed to the intentionally removed blueprint-html.ts identity ent_285e78427fbf837690b7f6133ad2701c, and exactly two present relationship bindings pointed to its deleted incident relationships. GROM-79 had removed all three canonical targets through public mutations, but reconciliation checked target existence before noticing the current successful snapshot omitted those records. The built-in self scanner truthfully reports partial coverage, so the supported repair is narrower than general partial-absence retirement: only a binding whose canonical target is already missing and whose current successful snapshot has no matching record becomes absent; ordinary missing observations keep live canonical targets, and any present record targeting the missing identity remains fail-closed. Rebased onto GROM-97, the public self-scan completes with 598 records, marks the retired component binding absent and both deleted relationships absent/removed, refreshes current source evidence, and repeats at byte-identical canonical digest 0ee9b0b037d79803959e6154518834ac3e6926c05746f1ae14561e7ea4f28d4d. The existing export writes a bounded 94-component local blueprint. Full bun run check passes formatting, types, boundaries, 503 tests / 3,156 assertions, native build/smoke, and the compiled Iteration 1A workflow.
<!-- SECTION:NOTES:END -->
