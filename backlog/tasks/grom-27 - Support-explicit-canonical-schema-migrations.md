---
id: GROM-27
title: Support explicit canonical schema migrations
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:57'
updated_date: '2026-07-15 20:12'
labels: []
milestone: m-4
dependencies:
  - GROM-21
  - GROM-23
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - ARCHITECTURE.md
  - backlog/tasks/grom-27 - Support-explicit-canonical-schema-migrations.md
  - src/application/README.md
  - src/application/index.ts
  - src/application/schema-migrations.ts
  - src/application/tests/schema-migrations.test.ts
  - src/cli/README.md
  - src/cli/contracts.ts
  - src/cli/help.ts
  - src/cli/parser.ts
  - src/cli/program.ts
  - src/cli/surface.ts
  - src/cli/tests/program.test.ts
  - src/cli/tests/surface.test.ts
  - src/core/README.md
  - src/core/index.ts
  - src/core/schema-migration.ts
  - src/host/README.md
  - src/host/bootstrap-configuration.ts
  - src/host/contracts.ts
  - src/host/default-bootstrap.ts
  - src/host/default-host-identities.ts
  - src/host/lifecycle.ts
  - src/host/local-plugin-packages.ts
  - src/host/tests/default-bootstrap.test.ts
  - src/host/tests/plugin-sdk-conformance.test.ts
  - src/host/tests/schema-migrations.test.ts
  - src/persistence/README.md
  - src/persistence/index.ts
  - src/persistence/local-transaction-journal.ts
  - src/persistence/schema-migration.ts
  - src/plugin-sdk/README.md
  - src/plugin-sdk/index.ts
  - tests/plugin-sdk.test.ts
priority: high
type: feature
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow canonical documents and plugin-owned records to evolve through explicit, previewable migrations instead of silently rewriting a workspace during ordinary reads or mutations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Groma reports the workspace schema floor, document versions, mixed-version state, and whether a complete migration path exists
- [x] #2 A migration preview describes every canonical resource that would change and performs no writes
- [x] #3 Applying a migration updates all affected resources transactionally and produces deterministic canonical output
- [x] #4 Missing, ambiguous, incompatible, or failed migrators leave the workspace byte-for-byte unchanged with actionable diagnostics
- [x] #5 Ordinary reads and mutations never perform an implicit schema migration
- [x] #6 Supported older-workspace fixtures migrate and reload through public operations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace official schema-token text matching with duplicate-safe top-level JSON/YAML/frontmatter scalar localization that preserves surrounding bytes and Markdown bodies.
2. Carry explicit catalog-versus-validation provenance through Application planning so apply returns provider-failure for catalog load/inspect faults while path and migrator defects remain validation-rejected.
3. Redesign Persistence catalog discovery around three optional exact root files plus bounded groma/intent and groma/records plane enumerations, ignoring unrelated trees while failing closed on canonical layout, depth, and entry bounds.
4. Add regressions for preceding/quoted schema keys, JSON spacing/order, transient catalog status/preview/apply CLI classification, unrelated deep/oversized trees, canonical truncation/overflow, and add/remove prepare-time CAS.
5. Run focused cross-layer validation, independent no-edit re-review, full repository checks, four target builds, Backlog validation, and exact diff inspection.
6. Recheck acceptance criteria, record final evidence through Backlog CLI, amend and force-push the same PR #28; leave merge and fresh exact-head Codex review to the root agent.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context Hunter classification: L3 public SDK/runtime, Application, Persistence, Host, and CLI contract change (equivalent to the skill rubric's high-risk L2). Existing canonical component and alias codecs reject older schemas, while LocalTransactionJournal already supplies exact-revision CAS, deterministic durable targets, crash recovery, and generation publication. The implementation will keep ordinary reads/mutations byte-preserving, run migrations only through explicit shared operations, use one separate migration adapter over the same journal protocol, and keep plugin contributions as bounded inert declarations whose callbacks are invoked only during preview/apply and contained on failure. No registry, remote acquisition, automatic rewrite, or second semantic store is in scope.

Final design: canonical schema tokens map to independent integer document versions; the workspace floor is the minimum observed version. Status is callback-free, preview executes unique bounded paths twice without writing, and apply publishes one deterministic all-resource batch. Persistence re-enumerates the exact catalog during prepare, so additions, removals, partial sets, stale revisions, and unrelated targets fail closed. Migration-only Host composition can read structurally compatible legacy config/lock schemas but normal startup remains strict. Trusted pinned plugins contribute through canonicalSchemaMigratorCapabilityId without receiving persistence authority.

Independent review findings corrected: migration-only config/lock bootstrap, trusted local contribution loading, invalid journal bounds, full-catalog prepare-time CAS, arbitrary-target prevention, intrinsic typed-array bounds, aggregate result bytes, bounded path expansion, duplicate schema parsing, bounded adapter replacement decoding, captured capability methods, stable public capability identity, and actionable locator/migrator diagnostics. Final independent re-review: PASS, no actionable findings; focused cross-layer review 111 tests / 869 expectations.

Validation passed: bun run check (624 tests, 4,346 expectations; formatting, typecheck, architecture boundaries, native build/smoke, Iteration 1A crash recovery); bun run check:targets (all 4 standalone targets); focused migration/Host/CLI/SDK run (55 tests, 516 expectations); backlog doctor; git diff --check.

Claude static review found no correctness defects in transactional migration, byte handling, or callback containment. Applied the relevant bounded feedback: aligned CLI help and test naming with the exact all-resource catalog batch; required an initialized workspace for migrate commands; made maxPathSteps exhaustion fail closed; documented the SDK own-enumerable plain-record boundary; and renamed the shared official groma schema migrator. Retained the 8 MiB aggregate migration ceiling as an explicit bounded first slice consistent with the delivery guardrail rather than expanding journal/resource capacities toward extreme-scale support; retained fail-closed rejection when any canonical resource lacks exactly one path; and retained safe generic provider-failure classification for prepare-time materialization faults. Independent post-Claude re-review: PASS, no actionable findings; focused re-review 57 tests / 527 expectations.

Reopened after exact-head Codex review 4707595488 identified three relevant P2 correctness gaps: official schema replacement assumes the schema key is first; apply collapses transient catalog provider failures into semantic validation rejection; and catalog enumeration lets unrelated groma/ subtrees consume canonical depth/entry bounds. Fixes remain on PR #28; no merge until a new exact-head review.

Implemented the reopened review slice: official migrators now replace the parsed unique top-level schema scalar while preserving surrounding bytes and Markdown bodies; Application retains transient catalog provider provenance without reclassifying malformed schemas or migrator output; Persistence catalogs three exact root records plus only the bounded intent and records planes. Added focused regressions for quoted/preceded YAML and compact JSON, status/preview/apply exit 5 mapping, unrelated depth/size, canonical layout/depth/entry bounds, and add/remove CAS. First focused checkpoint: typecheck, boundaries, 58 tests / 499 expectations green.

Exact-head Codex findings resolved: official migrators localize the unique top-level schema scalar independent of key order and preserve adjacent bytes, quote form, Markdown bodies, and LF/CRLF/CR block-scalar boundaries; catalog provider faults retain infrastructure provenance across status, preview, and apply while semantic defects remain validation; catalog discovery reads only three exact root records plus bounded intent and records planes, so unrelated trees do not consume canonical bounds while canonical truncation/layout/overflow still fail closed. Final independent no-edit re-review: PASS with no actionable findings; 50 focused tests / 447 expectations.

Final exact-diff validation passed: bun run check (631 tests, 4,389 expectations; formatting, typecheck, architecture boundaries, native build/smoke, Iteration 1A crash recovery); bun run check:targets (all 4 standalone targets); git diff --check.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented explicit, previewable, transactional canonical schema migrations and corrected the exact-head review gaps without weakening deterministic local state. Official migration is now parsed and byte-localized instead of position-dependent; provider failures remain distinguishable from validation failures; canonical catalog discovery is scoped to exact root documents and bounded intent/record planes while preserving fail-closed canonical bounds and prepare-time add/remove CAS. Public older-workspace fixtures prove deterministic exact-byte migration and reload, including reordered/quoted schema declarations, compact JSON, Markdown body isolation, and CRLF block scalars. Verified with bun run check (631 tests, 4,389 expectations), all four standalone target builds, focused cross-layer tests (50 tests, 447 expectations), independent PASS review, and git diff --check.
<!-- SECTION:FINAL_SUMMARY:END -->
