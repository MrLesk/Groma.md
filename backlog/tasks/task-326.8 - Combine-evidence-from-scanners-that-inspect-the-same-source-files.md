---
id: TASK-326.8
title: Combine evidence from scanners that inspect the same source files
status: Done
assignee:
  - '@codex-composition'
created_date: '2026-09-08 21:43'
updated_date: '2026-09-08 22:01'
labels:
  - scanners
dependencies: []
references:
  - ../callforpapers
  - TASK-295
  - scan-observation
  - typescript-scanner
  - source-relationships
  - scan-lifecycle
  - architecture-model
documentation:
  - docs/scanners/evidence.md
  - docs/scanners/creating-a-plugin.md
  - docs/component-markdown.md
modified_files:
  - packages/scanner/src/index.ts
  - plugins/scanners/typescript/src/source-operations.ts
  - src/scan-evidence.ts
  - src/relationship-inference.ts
  - src/scan-reconciler.ts
  - src/types.ts
  - src/scanner.ts
  - test/fixtures/scanner-composition/emitter.ts
  - test/fixtures/scanner-composition/handler.ts
  - test/fixtures/scanner-composition/alternate.ts
  - test/fixtures/scanner-composition/host.html
  - test-bun/scanner-composition.test.ts
  - test-bun/source-relationships.test.ts
  - docs/scanners/evidence.md
  - docs/scanners/creating-a-plugin.md
  - docs/relationship-inference.md
  - docs/component-markdown.md
parent_task_id: TASK-326
type: feature
ordinal: 369000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma core can combine observations from the embedded TypeScript scanner and an independently installed Angular scanner without duplicating architecture elements or hiding contradictory claims. The concrete consumer is the Java/Angular project at ../callforpapers. Angular carries compatible TypeScript tooling independently of Groma's embedded TypeScript 7.1 SDK, so compiler object and symbol IDs cannot be assumed to match.

Distinguish shared source identity, complementary evidence, and genuine disagreement. A file keeps one curated architecture owner while retaining contributions from both scanners. Unknown information in one scanner is not by itself a contradiction of a supported claim from another. Compare claims about the same source operation and relevant analysis context; genuinely incompatible certain claims must be reported, and the disputed evidence must not establish a derived relationship. Do not choose a winner by plugin name, arrival order, or a blanket Angular-over-TypeScript priority. Authored architecture remains authoritative.

Scope the contract change to one source file observed by both scanners, one complementary Angular binding, and one deliberately contradictory provider claim. Core owns evidence combination and inference; plugins own extraction. Compiler IDs and raw conflict evidence remain scan-time information, not new OKF metadata or C4 elements. Ordinary Markdown readers retain the existing file links and authored relationship meaning. Implement only the contract and behavior required by this example, not a general scanner negotiation system.

Automated tests use minimal fixtures under test/fixtures; ../callforpapers is the human-reviewed real-project acceptance source. All enabled scanners must still complete successfully before reconciliation starts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The same physical source file reported by TypeScript and Angular has one source identity and one curated architecture owner, while useful contributions from both scanners remain available.
- [x] #2 Operations and claims can be compared across different compiler instances using supported source identity and analysis context, without relying on equal compiler-internal IDs.
- [x] #3 A supported complementary Angular binding can contribute evidence when TypeScript lacks that information; an unresolved observation alone is not treated as a contradictory certain claim.
- [x] #4 A minimal fixture with incompatible certain provider claims for the same operation/context reports the conflict and does not derive a relationship from the disputed claim; plugin order does not change that outcome.
- [x] #5 Authored relationships and curated file membership survive overlapping observations, repeat scans, and conflicts; repeated agreeing evidence does not multiply the same derived interaction.
- [x] #6 An enabled scanner failure prevents reconciliation and preserves the previous complete architecture; successful observations with a reported evidence conflict remain distinguishable from scanner execution failure.
- [x] #7 The shared evidence contract documents this narrow behavior, and independent fixtures demonstrate overlap, complementary evidence, conflict, and repeat-scan ownership before real-project validation.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve one source owner by exact repository-relative file path, retaining scanner-specific Code contributions and curated Markdown.
2. Add optional UTF-16 source positions to operations, invocations, and concrete bindings. Compare canonical certain provider sets only at the same operation, invocation, member, and binding context; equal sets agree and differing sets report conflicts. Unresolved observations do not veto supported claims.
3. Keep the existing supplied named callback selection rule for the approved Angular output-to-handler binding. Do not add receiver/service inference or a new initial placement ranking. Raw positions and conflicts remain scan-time evidence.
4. Verify independent overlap, complementary unknown, conflict/order, repeat-scan curated ownership, and enabled-scanner failure atomicity cases using dedicated fixtures. Update the contract documentation.
5. Run focused checks, the coordinator-arranged cold simplicity review, an exclusive repository check, implementer specification/quality reviews, and the full-context review. Hold terminal status for coordinator approval.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one exact-path source owner with separate scanner Code contributions; optional UTF-16 positions let core compare operation/call/binding claims across compiler IDs. Certain canonical target sets must agree; unequal sets report conflicting-providers and cannot establish derived relationships. Unresolved observations do not veto supported claims. The named Angular output-to-handler case uses the existing supplied named callback rule; no receiver/service inference or initial placement ranking was added. Source positions and conflicts remain scan-time evidence, not OKF fields or C4 elements. Focused verification: 19 passing tests across scanner-composition, source-relationships, and scan-refresh; targeted Biome clean; bun run typecheck passes. Existing TypeScript binding expectation now checks the fixture-derived source offset. An earlier C# adapter test failure occurred during the separately owned C# work and was not changed here. Waiting for coordinator-arranged cold simplicity review and serialized bun run check.

Coordinator-arranged cold simplicity review passed without blocking findings or required simplifications; the reviewer independently ran the seven dedicated tests. Implementer specification review: AC1/5 covered by adding a second scanner to an already curated multi-file owner, preserving authored relationships, changed scope suggestions, and byte-stable reversed rescans; AC2 by position roundtrip/validation, different compiler IDs, and embedded source-offset extraction; AC3 by bound and binding-free unresolved observations alongside a certain binding; AC4 by conflicting singleton targets, reversed order, and shared-provider-owner suppression; AC6 by full scan rejection preserving the previous architecture snapshot and separate successful conflict summaries; AC7 by the independent fixture and shared contract docs. Implementer quality review inspected all task changes and found no reproducible defect, unnecessary framework, ownership ambiguity, or missing test in the approved flow. New/changed source and test files remain under 500 lines and targeted lint reports no complexity warning. No source changes after the cold review. Full repository check is being run once by the coordinator-designated discovery worker over the stable first-wave snapshot; real-project Angular extraction and map acceptance remain coordinator work.

Final gates passed: coordinator-arranged full-context composition review reported no blocking findings; coordinator accepted the independent fixture outcomes and shared contract. The serialized full repository check passed on the unchanged composition snapshot: Node 110 passed; Bun 379 passed, 1 unrelated Java tooling integration test skipped, 0 failed. Full log: /tmp/groma-csharp-sdk-XrB499/full-check.log. No source changes followed that check or either external review. All task acceptance criteria and Definition of Done items are now checked against the recorded evidence. Task remains In Progress only for coordinator scope inspection and finalization; no commit or live architecture modification was performed. Actual Angular plugin extraction and callforpapers map validation remain the separately assigned TASK-326.9 and parent acceptance work.

Coordinator accepted the completed task scope and all review gates under delegated authority. Marked Done for the authorized scoped commit and push on main; only the 17 recorded implementation/documentation/test files and this task record belong to this commit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Core preserves one owner per exact source path while retaining TypeScript and Angular Code contributions. Optional source positions allow compiler-independent comparison of invocation and binding claims: agreeing certain providers deduplicate, unknown observations do not veto supported claims, and differing certain providers are reported and excluded from derived relationships. Authored Markdown remains authoritative. Verified by seven independent composition tests, 19 focused tests, clean targeted lint/type checks, the shared full repository check (Node 110 pass; Bun 379 pass, 1 unrelated tooling skip, 0 fail), implementer specification/quality reviews, both required external reviews, and coordinator acceptance of fixture outcomes. Ready for coordinator finalization.
<!-- SECTION:FINAL_SUMMARY:END -->
