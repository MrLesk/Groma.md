---
id: GROM-42
title: Expose supporting evidence in component detail
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-19 19:03'
labels: []
milestone: m-3
dependencies:
  - GROM-28
  - GROM-29
  - GROM-37
  - GROM-41
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - src/application/contracts.ts
  - src/application/operations.ts
  - src/application/reconciliation.ts
  - src/application/snapshot-state.ts
  - src/application/index.ts
  - src/application/README.md
  - src/cli/README.md
  - src/cli/tests/scan.test.ts
  - src/host/tests/reconciliation-local.test.ts
  - groma/evidence.md
  - groma/transaction-state.json
priority: high
type: feature
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the existing public component detail explain why an observed component exists by returning its canonical intent beside the exact bounded scan evidence that supports it. This is the shortest agent-facing evidence slice: it reuses the canonical evidence state already loaded atomically with the component and does not introduce a global evidence index, generalized filters, sharding, confidence scoring, or curation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `component get` returns supporting evidence separately from the canonical component, including project and scanner identity, binding scope/key/presence, relevant coverage, and directly related observation records with provenance
- [x] #2 The component and evidence are read from one exact canonical generation; aliases resolve consistently and malformed evidence fails closed
- [x] #3 Evidence detail is deterministic and bounded by existing observation, reconciliation, and application-response limits without a new index or persistence format
- [x] #4 Components without supporting scan evidence return an explicit empty evidence list without changing curated intent or canonical bytes
- [x] #5 Plain and JSON CLI results expose the same evidence detail through the existing component command with no new semantic path
- [x] #6 Focused application, host, CLI, and compiled self-dogfood verification demonstrate supporting provenance for an automatically observed Groma component and byte-stable read-only behavior
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the canonical evidence parser and extend the existing snapshot decoder to retain the already-copied evidence plane. 2. Derive component-scoped evidence views inside `getComponent` from the same transaction snapshot generation, including records that directly reference the bound candidate. 3. Extend the existing public result type and CLI rendering path without adding a command or persistence format. 4. Add focused contract/composition tests for observed, curated-only, alias, missing, and malformed evidence behavior. 5. Build Groma, scan itself, inspect an observed component through the compiled CLI, prove the read leaves canonical bytes unchanged, run the full gate, then complete the bounded review and PR workflow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the thin shared-read slice without a new command, index, store, or persistence format. The existing snapshot decoder retains the already-copied evidence plane; component get validates it with reconciliation's canonical parser and returns only bindings and records that resolve to the exact component. Coverage includes the binding scope and every returned record scope. Tests cover observed detail, curated-only empty evidence, alias resolution, malformed evidence, CLI JSON/plain exposure, and canonical byte preservation.

Validation: focused reconciliation and CLI tests passed (15 tests, 171 assertions); the full repository gate passed (403 tests, 2,667 assertions), including formatting, TypeScript, architecture boundaries, full tests, build, smoke, and iteration verification.

Compiled self-dogfood: the final source scan advanced canonical generation to 118, then an unchanged rescan was byte-stable at tree digest 1b90af090cad52faaa7e1c98225f4e03761cd739dab92c497230b93a4836c309. Compiled component get for Groma's application source boundary returned one present binding, complete workspace coverage, one component record, five relationship records, and provenance across twelve source resources in both JSON and plain output; the read left the digest unchanged.

Pre-PR review completed with exactly two independent gpt-5.6-terra xhigh passes and one local Claude pass. Neither Terra reviewer found an actionable issue; Claude returned no findings.

First automatic Codex review found one justified P2: a stale binding for a removed observed component could fail unrelated component detail reads. The fix ignores unresolvable bindings because they cannot support any currently readable component, while preserving full evidence parsing and valid alias resolution. The existing alias/curated test now removes a second observed component first and proves only relevant evidence is returned. Post-fix focused checks passed (15 tests, 172 assertions) and the full gate passed (403 tests, 2,668 assertions). Final compiled self-scan advanced to generation 119, then repeated byte-identically at digest c21a87b62d9c3bcc8c079fdc1f8ebd6ef6aa5da94587a3654a1b6074f02652f8; component detail remained read-only with six records across twelve provenance resources.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Exposed bounded supporting scan evidence beside exact canonical component detail through the existing shared read path. The result includes source identity, binding state, relevant coverage, directly related records, and provenance from one canonical generation while curated-only components remain explicitly empty. Reused the canonical evidence parser and snapshot composition with no new command, index, store, or persistence format. Fixed the first automatic Codex finding so stale bindings for removed observed components cannot poison unrelated reads. Verified with 403 repository tests and 2,668 assertions, compiled self-scan generation 119 with a byte-stable repeat/read digest, exactly two Terra xhigh reviews, one local Claude review, the first automatic Codex review, and green cross-platform CI. Merged as PR #48.
<!-- SECTION:FINAL_SUMMARY:END -->
