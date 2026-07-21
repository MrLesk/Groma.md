---
id: GROM-100
title: Repair stale self-blueprint reconciliation bindings
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 18:39'
updated_date: '2026-07-21 18:56'
labels: []
dependencies: []
modified_files:
  - >-
    backlog/tasks/grom-100 -
    Repair-stale-self-blueprint-reconciliation-bindings.md
  - groma/components/groma/cli.md
  - groma/components/groma/cli/contracts.ts.md
  - groma/components/groma/cli/parser.ts.md
  - groma/components/groma/core/graph-query.ts.md
  - groma/components/groma/core/observation.ts.md
  - groma/components/groma/host/lifecycle.ts.md
  - groma/components/groma/host/typescript-bun-scanner.ts.md
  - groma/components/groma/persistence/local-transaction-journal.ts.md
  - groma/components/groma/web/client/api.ts.md
  - groma/components/groma/web/export.ts.md
  - >-
    groma/evidence/9080456d7c02f714535c79e12ec95bf94300adecfd94940588720b677f9a96a4.json
  - groma/transaction-state.json
  - src/application/reconciliation.ts
  - src/host/tests/reconciliation-local.test.ts
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
- [x] #1 A fresh public Groma self-scan completes successfully on the current repository instead of failing with reconciliation-binding-missing for removed source evidence
- [x] #2 The repair preserves curated component intent and stable canonical identities while updating or retiring stale scanner-owned evidence only through supported semantic operations
- [x] #3 Two consecutive self-scans produce deterministic byte-stable canonical state and a bounded blueprint consumable by the existing visual surface
- [x] #4 Focused reconciliation coverage and the complete repository quality gate pass without weakening ambiguity handling
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce the stale-binding failure and compare current canonical entities/relations with retained scanner bindings. 2. When canonical target state is already absent, retire only a dangling component or relationship binding that the current successful snapshot does not contain; keep a present conflicting observation fail-closed and leave live canonical targets under existing partial-coverage preservation. 3. Add focused component and relationship regressions proving omitted dangling bindings retire, present conflicts still fail, and repeats are byte-stable under partial and complete coverage. 4. Run the public self-scan twice, inspect the operation-produced canonical diff and visual export, then run the complete quality gate. 5. Complete exactly two Terra xhigh reviews and one Claude review, resolve justified findings, create one ready PR, handle the first Codex review and green CI, then merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter L2 trace: pre-repair canonical state had 93 components and 278 relationships. Exactly one retained component binding pointed to the intentionally removed blueprint-html.ts identity ent_285e78427fbf837690b7f6133ad2701c, and exactly two present relationship bindings pointed to its deleted incident relationships. GROM-79 had removed all three canonical targets through public mutations, but reconciliation checked target existence before noticing the current successful snapshot omitted those records. The built-in self scanner truthfully reports partial coverage, so the supported repair is narrower than general partial-absence retirement: only a binding whose canonical target is already missing and whose current successful snapshot has no matching record becomes absent; ordinary missing observations keep live canonical targets, and any present record targeting the missing identity remains fail-closed. The final public self-scan completes with 598 records, marks the retired component binding absent and both deleted relationships absent/removed, and repeats at byte-identical canonical digest 32cdccba8a6e0b0ea1d39731d8129b305faaca64d7593cf281709f6b869f9d74. The existing export writes a bounded 94-component local blueprint. Both required Terra xhigh reviews returned no findings. Claude found the boundary manifesto-aligned and suggested clearer symmetric control flow plus a focused incoming/outgoing incident-binding fixture; both were adopted. Its scope observations concerned GROM-97, already present on origin/main, and were non-actionable. Final bun run check passes formatting, types, boundaries, 504 tests / 3,172 assertions, native build/smoke, and the compiled Iteration 1A workflow.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Repaired self-reconciliation by retiring only omitted scanner bindings whose canonical targets were already removed, while present conflicting observations still fail closed. Refreshed Groma's checked-in evidence through the public scan path and proved two byte-identical rescans plus a bounded 94-component export. Added focused component, direct-relationship, and incoming/outgoing incident-binding regressions. Final verification: bun run check with 504 tests and 3,172 assertions; two Terra reviews found no issues; Claude's justified legibility and incident-fixture feedback was incorporated.
<!-- SECTION:FINAL_SUMMARY:END -->
