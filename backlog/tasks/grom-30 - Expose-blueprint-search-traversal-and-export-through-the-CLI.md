---
id: GROM-30
title: Expose blueprint search traversal and export through the CLI
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:57'
updated_date: '2026-07-17 01:06'
labels: []
milestone: m-2
dependencies:
  - GROM-29
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - ARCHITECTURE.md
  - src/application/README.md
  - src/application/contracts.ts
  - src/application/operations.ts
  - src/application/tests/fixtures/query-authority-child.ts
  - src/application/tests/operations.test.ts
  - src/cli/README.md
  - src/cli/contracts.ts
  - src/cli/help.ts
  - src/cli/parser.ts
  - src/cli/surface.ts
  - src/cli/tests/parser.test.ts
  - src/cli/tests/program.test.ts
  - src/cli/tests/surface.test.ts
  - src/host/README.md
  - src/host/default-bootstrap.ts
  - src/host/lifecycle.ts
  - src/host/tests/default-bootstrap.test.ts
  - src/host/tests/lifecycle.test.ts
  - tests/iteration-1a/verify.ts
priority: high
type: feature
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the detailed raw blueprint directly useful without AI by exposing the query engine through shared operations and deterministic human-readable and machine-readable CLI results. A 43-component, 83-relationship real-project baseline required repeated outgoing component-local reads because inbound and whole-graph queries were unavailable, while aggregate output omitted intent, actions, and relationships.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Shared application operations and the CLI expose component search, bounded traversal, inbound and outgoing relationships, and aggregate subgraph reads
- [x] #2 A caller can export the complete current blueprint by consuming deterministic bounded pages without relying on the interactive terminal renderer
- [x] #3 Plain and JSON results contain the same semantic data, include generation and continuation information, and preserve the one-bounded-result rule
- [x] #4 Sparse and rich recursive components expose intent, inputs, outputs, actions, containment, and ordinary relationships in raw output
- [x] #5 Fresh-process reads after restart return the same semantics and do not modify canonical state
- [x] #6 CLI surfaces use shared query operations and cannot bypass projection generation checks
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend shared Application Operations with projection-backed exportBlueprint, searchBlueprint, and traverseBlueprint requests and canonical Standard Model results while preserving graph generation and opaque cursors. 2. Capture the replaceable graph query engine as an untrusted capability; settle and contain results, scope diagnostics by operation and cursor state, apply component and relationship bounds, reject non-advancing cursors, validate breadth-first order and endpoints, and resolve public traversal roots through exactEntity so durable aliases bind to a generation-matched canonical root. 3. Require groma.graph-query/v1 in the official Application plugin and inject it at Host composition while keeping HostSurfaceContext limited to shared operations. 4. Return each export page as a self-contained bounded aggregate of selected components and all of their outgoing depth-1 relationships; gather internal traversal pages at one generation, preserve only the fingerprint-bound component cursor, reject duplicates and mismatched sources, enforce maxRelationships, and share one maxSnapshotStateValues budget across the complete returned page. 5. Add blueprint export, blueprint search, and blueprint traverse commands with exact bounded parsing, a 4,096-character cursor ceiling, deterministic plain and JSON semantic parity, and infrastructure handling for graph-query-unavailable. 6. Document and prove complete export using only export pages, durable-alias traversal, same-generation history mismatch rejection, sparse and rich recursive semantics, incoming/outgoing/both traversal, restart stability, no canonical writes, compiled-process continuity, hostile capabilities, bounds, cursor progress, diagnostic routing, and final repository checks and independent reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context Hunter classification: L2/high-risk public application and CLI capability exposure. Independent read-only architecture and CLI audits agree GROM-29 already supplies every required Core/Persistence primitive. GROM-30 stays in Application, Host composition, and CLI. Complete export is deliberately a two-phase bounded protocol over unchanged query-engine cursors: page projected components, then page outgoing depth-1 traversal for each source at the same generation. This makes every relationship appear once without hidden cursor following, nested/composite cursor state, canonical snapshot reads, or a second semantic authority. The CLI namespace is blueprint export/search/traverse. A required compatibility correction raises the CLI cursor input ceiling from 2,048 to 4,096 characters because the official engine can validly emit 3,864-character cursors.

Implementation completed on agent/grom-30-cli-query. Shared Application Operations now provide projection-backed export, search, and bounded traversal; the official Host injects groma.graph-query/v1 while the CLI can reach it only through shared operations. The CLI exposes blueprint export/search/traverse with opaque cursors, deterministic plain/JSON semantic parity, explicit incoming/outgoing/both traversal, and the documented two-phase complete-export protocol. Provider results are contained, canonicalized, structurally validated, generation-bound, and sanitized through an application-owned diagnostic allowlist. Documentation and fresh-process regressions cover sparse/rich recursive components, intent and embedded items, containment and ordinary relationships, 4,096-character cursor input, restart stability, canonical-state immutability, and stale-generation rejection. Verification evidence: focused suite 193 pass / 1,759 assertions; bun run check 702 pass / 4,924 assertions plus format, typecheck, boundaries, build, smoke, compiled workflow, and crash recovery; bun run check:targets verified all 4 standalone executable targets.

Independent pre-PR spec review found the original two-phase cross-command export protocol could mix same-generation histories: each first traversal query lacked the component cursor's projection-fingerprint binding. The plan is corrected without a new Core/Persistence cursor authority: blueprint export pages now include complete outgoing relationships for their selected component sources within one Host operation, compare every traversal page generation, and carry only the original fingerprint-bound component cursor across processes. Independent code-quality review also requires relationship-specific page bounds, rejection of non-advancing engine cursors, stricter breadth-first depth validation, and operation/cursor-scoped diagnostic allowlisting before finalization.

Independent-review remediation completed. Blueprint export now returns self-contained bounded items containing one canonical component and all outgoing depth-1 Standard relationships for that source. Application gathers internal traversal pages sequentially, preserves only the fingerprint-bound component cursor and its generation/hasMore, requires every traversal page to match that generation, validates source/direction/depth/endpoints/type/order, rejects page and aggregate duplicate relation identities, and enforces the page-wide maxRelationships aggregate without a composite cursor. Component and relationship query limits are separated; provider pages cannot exceed the requested or operation-specific bound. All query paths reject non-advancing cursors. Traversal containment now requires a cursorless nonempty page to begin at depth 1 and forbids depth jumps greater than one, while allowing resumed pages to begin deeper. Provider diagnostics are allowlisted by export/search/traverse operation and cursor presence, preserving only diagnostics possible for that exact invocation. CLI and compiled verification now complete exports using only export pages and prove a cursor from history A fails closed with cursor-query-mismatch against different content at the same numeric generation in history B without canonical writes. Remediation evidence: focused Application suite 88 pass / 783 assertions; combined Application/CLI suite 131 pass / 1,321 assertions; bun run check 709 pass / 4,962 assertions including format, typecheck, boundaries, build, smoke, compiled workflow, same-generation continuity, and crash recovery; bun run check:targets verified all 4 standalone targets; git diff --check clean.

Final quality remediation completed. Public traversal now validates depth-1 roots against graphQueries.exactEntity after a traversal page succeeds: durable aliases may emit their canonical root, exact/traversal generations must match, and endpoint-valid hits from any other root still fail closed. Export supplies its already-canonical component root and avoids the extra exact lookup. Application coverage proves first and continued alias pages; the real CLI merge workflow traverses the obsolete durable alias and returns the survivor as from. Export also owns one incremental maxSnapshotStateValues budget across the final page envelope, component items, and relationships accumulated over internal traversal pages; a hostile two-page result that is safe page-by-page now fails before the second relationship is appended. Evidence: focused Application/CLI suite 132 pass / 1,333 assertions; bun run check 710 pass / 4,972 assertions including format, typecheck, boundaries, all tests, build, smoke, compiled workflow, and crash recovery; git diff --check clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added projection-backed blueprint export, search, and bounded traversal to shared Application Operations and the CLI, with self-contained component-plus-relationship export pages, durable-alias root validation, generation and fingerprint continuity, aggregate structural/count bounds, and deterministic plain/JSON parity. Wired the official graph-query capability through Host without exposing it to CLI surfaces, documented the contract, and added hostile-provider, restart, compiled-process, same-generation history, sparse/rich semantic, relationship-direction, alias, and canonical-state immutability regressions. Verified with 132 focused Application/CLI tests and 1,333 assertions; full bun run check with 710 tests and 4,972 assertions; all format, typecheck, boundary, build, smoke, compiled workflow, crash-recovery, target, and diff checks; independent specification PASS and final quality APPROVED.
<!-- SECTION:FINAL_SUMMARY:END -->
