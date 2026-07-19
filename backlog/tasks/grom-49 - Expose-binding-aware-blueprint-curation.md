---
id: GROM-49
title: Preserve observed-component merges across rescans
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 20:00'
updated_date: '2026-07-19 19:32'
labels: []
milestone: m-3
dependencies:
  - GROM-30
  - GROM-37
  - GROM-41
  - GROM-42
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - src/application/reconciliation.ts
  - src/host/tests/reconciliation-local.test.ts
  - src/application/README.md
  - src/cli/README.md
  - groma
priority: high
type: feature
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let a human or agent reconcile one automatically observed component with an existing curated component using the existing merge operation, then preserve that decision across later scans. Reconciliation follows the canonical component alias, migrates the source-owned binding to the surviving stable identity, and continues refreshing only scanner-owned fields. This is the smallest binding-aware curation slice; it adds no bind/rebind/ignore/history command, split/pin model, or second curation path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The existing component merge command can merge an automatically observed component into an existing curated component while retaining the curated stable identity and intent
- [x] #2 The next scan resolves the prior observation binding through the canonical alias, persists the surviving component identity, and refreshes only scanner-owned projection fields
- [x] #3 Observed members and relationships continue to target the surviving component consistently without duplicating the removed automatic component
- [x] #4 Missing or ambiguous binding targets still fail closed with no canonical mutation; unrelated stale bindings do not block valid reads
- [x] #5 Plain and JSON CLI workflows use existing component get, component merge, and scan operations with deterministic results and no new semantic path
- [x] #6 A focused host regression and compiled Groma self-dogfood merge prove curated intent and evidence survive an unchanged byte-stable rescan
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Resolve the active source's prior component bindings through the already-loaded canonical alias graph before planning mutations, failing closed on genuinely missing or ambiguous targets. 2. Persist the resolved survivor identity in the refreshed evidence binding and use it for component members and relationship endpoints. 3. Extend the existing reconciliation composition test to merge an observed component into curated intent, rescan, restart, and verify identity, intent, evidence, and byte stability. 4. Use the compiled CLI to merge Groma's observed application boundary into its curated Shared Application Operations component, rescan twice, and inspect the result. 5. Run the full gate and the bounded two-Terra-plus-Claude review workflow before one ready PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the smallest binding-aware curation path by composing reconciliation with the existing graph alias resolver. Before planning a refreshed source, prior component bindings resolve to current canonical survivors; collisions within the active source or against another source fail with reconciliation-binding-ambiguous. Relationship binding projections retain their prior IDs only for scanner-ownership comparison, then migrate endpoints to resolved survivors for current, omitted, and partial coverage cases. The refreshed evidence persists the survivor identity; no new command, binding store, history model, or fallback path was added.

Focused validation passed across reconciliation, application-operation composition, and CLI scan tests (21 tests, 284 assertions before the final collision case; the final reconciliation suite passes 15 tests, 156 assertions). The complete repository gate passed with 405 tests and 2,693 assertions, including formatting, TypeScript, architecture boundaries, build, smoke, and compiled crash recovery.

Compiled self-dogfood used existing commands to merge observed application component ent_70eb3f258a30b901b69684b60b4ab648 into curated Shared Application Operations ent_596f62cc63bacd108c69d5600f37fac1 at generation 120. The next scan migrated the evidence binding and all relationship projection endpoints while preserving curated identity, name, intent, members, and relationships. Final source changes advanced the scan to generation 122; repeated JSON and plain scans, alias-based component detail, and blueprint export were byte-stable at digest 88507f9c95e2c46d7e5c4f35dcbe355e06738f6e15de3f08fa058bbea063345c. The blueprint now has 58 components, no duplicate automatic application component, one curated survivor with ten outgoing relationships, and six supporting evidence records.

Pre-PR review completed with exactly two independent gpt-5.6-terra xhigh passes and one local Claude pass. One Terra reviewer found a missing cross-source alias-collision regression; the added two-scanner test proves reconciliation-binding-ambiguous and unchanged evidence. Claude found that a relationship endpoint change after alias migration added the obsolete source ID to touchedComponents; the fix uses the resolved prior source and the merge regression now changes a stable relationship key to a new endpoint before proving byte-stable repetition. The other Terra pass had no findings. Post-review full validation passed with 406 tests and 2,702 assertions. The final compiled self-scan advanced to generation 123 and repeated byte-identically at digest 8ba0d203402712911db9d3b8c503b9b048acf3d3474a7fd1666d22e9d8459c21; alias-based detail still returned the curated survivor, ten relationships, and six evidence records without changing bytes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged PR #49 at 5791ff82f41b06c2b88fbeece70450b0b222b57b. Reconciliation now follows canonical aliases so an observed component can be merged into curated intent and remain merged across rescans. Binding and relationship projections migrate to the curated survivor, ambiguous same-source and cross-source collisions fail closed, and no parallel curation framework or command was added.

The complete gate passed with 406 tests and 2,702 assertions. Groma self-dogfood reduced the blueprint from 59 to 58 components by merging its observed application boundary into Shared Application Operations; curated intent, stable identity, ten relationships, and six evidence records survived repeated byte-stable scans at generation 123 and digest 8ba0d203402712911db9d3b8c503b9b048acf3d3474a7fd1666d22e9d8459c21. Two Terra xhigh reviews, one Claude review, and the first automatic Codex review completed; justified findings were fixed before merge.
<!-- SECTION:FINAL_SUMMARY:END -->
