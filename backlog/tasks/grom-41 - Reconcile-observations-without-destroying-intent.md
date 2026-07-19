---
id: GROM-41
title: Reconcile observations without destroying intent
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-19 16:57'
labels: []
milestone: m-3
dependencies:
  - GROM-26
  - GROM-35
  - GROM-37
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Turn one completed bounded observation snapshot into stable automatic architecture and a readable canonical evidence record while preserving curated meaning. This is the thin built-in reconciliation seam for the first public scan loop: one unsharded local evidence document, ordinary canonical automatic components, and atomic publication through existing transactions. Explicit bind, ignore, split, and regroup curation remains GROM-49; broad evidence filtering remains GROM-42.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A completed built-in snapshot atomically records source-owned evidence and creates ordinary automatic components with newly minted opaque identities plus durable observation-key bindings
- [x] #2 A repeated key reuses identity; evidence-derived fields refresh only while they still equal prior scanner-owned values, so curated overrides and conceptual parents are never overwritten
- [x] #3 A successful replacement affects only the exact project and scanner source, retains bindings and components for missing observations, and records complete or partial coverage without allowing one source to erase another
- [x] #4 Component members and relationships resolve only through exact bindings; unresolved or ambiguous references fail closed with no canonical change
- [x] #5 An identical completed snapshot is a canonical byte no-op, while every changed snapshot commits evidence, bindings, automatic components, relationships, and projection notification as one transaction
- [x] #6 Focused integration tests cover first scan, unchanged rescan, rename, disappearance and reappearance, overlapping sources, curated override preservation, and malformed or ambiguous references without introducing sharding, durable provisional scans, or compatibility fallbacks
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add one bounded Application reconciliation operation that validates completed snapshots, loads prior canonical evidence and bindings, and plans Standard Model mutations using existing transaction execution. 2. Add one deterministic Markdown evidence document and extend the current local canonical transaction adapter so evidence plus automatic component and relationship mutations publish atomically. 3. Compose the reconciliation operation as the scanner runtime completed-snapshot consumer and keep failed or incomplete scans outside the transaction path. 4. Add focused Application/Persistence/Host integration tests for stable binding, scanner-owned refresh, curated preservation, source isolation, missing evidence, ambiguity, idempotence, and restart. 5. Use Groma self-queries to compare the implemented seam with its curated architecture, update current architecture documentation, then run the full repository gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L2 cross-module semantic change. Supported boundary: completed snapshots from the built-in TypeScript/Bun scanner over bounded local projects. Reconciliation accepts only exact component, member, and relationship references within the completed snapshot; ambiguity or malformed data produces no commit. This slice deliberately omits explicit bind/ignore/regroup curation, general third-party ingestion, evidence sharding, durable provisional scan recovery, and broad evidence query matrices.

Implemented as one Application reconciliation operation, one deterministic groma/evidence.md store, and a small extension to the existing atomic Markdown transaction adapter. Equivalent observations ignore operational scan epochs for canonical no-op behavior; partial coverage never infers absence. Groma self-queries confirmed the seam matches the intended Reconciliation Engine while also exposing stale speculative self-blueprint descriptions that remain for later supported curation. Verification: bun run check (389 tests) and bun run check:targets passed on 2026-07-19.

Pre-PR review: two independent gpt-5.6-terra xhigh agents completed one bounded pass each. Their justified findings were fixed: reconciliation now aligns its 100-component/100-relationship/member envelope with one Standard Model transaction, rejects stale component bindings consistently, replans if any canonical state changes during revision confirmation, and covers these cases with focused regression tests. Final verification after fixes: bun run check passed with 391 tests; bun run check:targets passed for all four targets.

Automatic Codex review identified five actionable edge cases. Fixed all five: relationships now require endpoints observed in the current snapshot; retained and refreshed members share one aggregate bound; cancellation is no longer reported after atomic publication starts; reconciliation preflights the same 100,000-value transaction envelope used by the engine and caps records at 10,000; member item IDs percent-encode scope and key. Regression coverage was added. Verification after fixes: bun run check passed with 392 tests and bun run check:targets passed.

A follow-up automatic Codex review identified five additional reconciliation edge cases. Fixed all five: member retention now follows each member observation's coverage scope; transaction conflicts retry through the bounded replan loop; indeterminate outcomes preserve their recovery token at the Application seam; curated member lists with extensions remain distinguishable from absent scanner-owned fields; and explicitly deleted curated relationships are not resurrected while scanner-owned omissions can still reappear. Regression coverage was added. Verification after fixes: bun run check passed with 395 tests and bun run check:targets passed for all four targets.

A third automatic Codex pass found four supported-boundary issues. Fixed all four: automatic component and relationship ownership markers advance only when their values are actually applied; restoring the last automatic value relinquishes curation even for an otherwise identical snapshot; partial coverage retains omitted members while accepting members actually observed; and the single evidence document is capped at 4 MiB so oversized input fails before the existing 8 MiB atomic replacement envelope. Regression coverage was added. Verification after fixes: bun run check passed with 397 tests and bun run check:targets passed for all four targets.

The awaited online Codex pass found three final fail-closed issues. Fixed all three: indeterminate reconciliation now remains an explicit scanner report with its recovery token; present null evidence is rejected rather than treated as an absent evidence plane; and evidence is limited to half the shared snapshot-value envelope while retaining the 4 MiB byte cap. Regression coverage was added. Verification after fixes: bun run check passed with 399 tests and bun run check:targets passed for all four targets. Per Alex's amended review policy, subsequent automatic Codex passes are not awaited after these reviewed fixes; green CI is the remaining merge gate.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented bounded completed-snapshot reconciliation for the built-in scanner: stable opaque component and relationship bindings, scanner-owned field refresh with curated override preservation and explicit relinquishment, source-scoped complete/partial coverage, fail-closed references and malformed evidence, atomic evidence/intent publication, conflict retry, and recoverable indeterminate scan reports. Verified with 399 passing tests, formatting, typecheck, architecture boundaries, compiled binary smoke/crash recovery, all four target builds, two Terra xhigh reviews, one Claude attempt, the awaited Codex review findings, and green PR CI. Merged in PR #44.
<!-- SECTION:FINAL_SUMMARY:END -->
