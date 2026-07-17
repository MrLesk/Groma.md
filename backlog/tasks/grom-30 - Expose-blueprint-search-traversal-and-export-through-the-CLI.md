---
id: GROM-30
title: Expose blueprint search traversal and export through the CLI
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:57'
updated_date: '2026-07-17 02:22'
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
  - src/core/README.md
  - src/core/graph-query.ts
  - src/host/README.md
  - src/host/default-bootstrap.ts
  - src/host/default-host-identities.ts
  - src/host/lifecycle.ts
  - src/host/tests/default-bootstrap.test.ts
  - src/host/tests/lifecycle.test.ts
  - src/host/tests/plugin-sdk-conformance.test.ts
  - src/persistence/README.md
  - src/persistence/projection-query-engine.ts
  - src/persistence/tests/projection-query-engine.test.ts
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
1. Publish groma.graph-query/v2 with identity(), one explicit expected ProjectionReadIdentity on every data-bearing query, and one captured validated maxPageSize; keep fingerprints operational and internal to shared operations. 2. Update the official projection query engine to serve every provider read under the caller-selected expected identity, fail closed on generation or same-generation fingerprint drift, preserve stale-cursor versus cursor-query-mismatch precedence, and document stable-ID entity/search order. 3. Update Application Operations so each export, search, and traversal captures exactly one frozen query identity, passes it to every query and alias-resolution call, and requires returned generations to match; contain hostile identity and maxPageSize values at construction and invocation boundaries. 4. Keep export as one self-contained bounded Application aggregate, but use min(engine maxPageSize, remaining relationship allowance) for internal outgoing traversal pages instead of the caller component limit; preserve source/order/duplicate/cursor/count/structural checks and the sole public component cursor. 5. Strengthen traversal defense-in-depth on cursorless pages by requiring each deeper hit to originate in the prior discovered frontier; accept valid resumed pages whose frontier began before the page boundary, leaving opaque cross-page BFS semantics to the query engine contract. 6. Publish the expanded application surface only as groma.operations/v2; full workspace and blueprint use require v2, while the initialization boundary recognizes the exact legacy v1 operations shape only to capture initialize and never lets v1 impersonate v2. 7. Preserve the CLI command/result shapes, accept fixed-position blueprint search text beginning with --, remove unreachable query diagnostic message entries, and update Core, Persistence, Application, Host, CLI, architecture, and Backlog documentation. 8. Prove same-generation fingerprint drift fails before mixed export, one identity reaches every call, cursor precedence and fresh-process continuation, limit-1 export uses the engine page maximum, hostile identity/page-size containment, disconnected first-page depth rejection, valid connected/cyclic/both/resumed traversal, exact v2 manifests plus legacy-v1 init, existing bounds/aliases/no-write semantics, then run focused suites, full checks, target checks, CI, Claude, Codex, specification, and quality review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context Hunter classification: L2/high-risk public application and CLI capability exposure. Independent read-only architecture and CLI audits agree GROM-29 already supplies every required Core/Persistence primitive. GROM-30 stays in Application, Host composition, and CLI. Complete export is deliberately a two-phase bounded protocol over unchanged query-engine cursors: page projected components, then page outgoing depth-1 traversal for each source at the same generation. This makes every relationship appear once without hidden cursor following, nested/composite cursor state, canonical snapshot reads, or a second semantic authority. The CLI namespace is blueprint export/search/traverse. A required compatibility correction raises the CLI cursor input ceiling from 2,048 to 4,096 characters because the official engine can validly emit 3,864-character cursors.

Implementation completed on agent/grom-30-cli-query. Shared Application Operations now provide projection-backed export, search, and bounded traversal; the official Host injects groma.graph-query/v1 while the CLI can reach it only through shared operations. The CLI exposes blueprint export/search/traverse with opaque cursors, deterministic plain/JSON semantic parity, explicit incoming/outgoing/both traversal, and the documented two-phase complete-export protocol. Provider results are contained, canonicalized, structurally validated, generation-bound, and sanitized through an application-owned diagnostic allowlist. Documentation and fresh-process regressions cover sparse/rich recursive components, intent and embedded items, containment and ordinary relationships, 4,096-character cursor input, restart stability, canonical-state immutability, and stale-generation rejection. Verification evidence: focused suite 193 pass / 1,759 assertions; bun run check 702 pass / 4,924 assertions plus format, typecheck, boundaries, build, smoke, compiled workflow, and crash recovery; bun run check:targets verified all 4 standalone executable targets.

Independent pre-PR spec review found the original two-phase cross-command export protocol could mix same-generation histories: each first traversal query lacked the component cursor's projection-fingerprint binding. The plan is corrected without a new Core/Persistence cursor authority: blueprint export pages now include complete outgoing relationships for their selected component sources within one Host operation, compare every traversal page generation, and carry only the original fingerprint-bound component cursor across processes. Independent code-quality review also requires relationship-specific page bounds, rejection of non-advancing engine cursors, stricter breadth-first depth validation, and operation/cursor-scoped diagnostic allowlisting before finalization.

Independent-review remediation completed. Blueprint export now returns self-contained bounded items containing one canonical component and all outgoing depth-1 Standard relationships for that source. Application gathers internal traversal pages sequentially, preserves only the fingerprint-bound component cursor and its generation/hasMore, requires every traversal page to match that generation, validates source/direction/depth/endpoints/type/order, rejects page and aggregate duplicate relation identities, and enforces the page-wide maxRelationships aggregate without a composite cursor. Component and relationship query limits are separated; provider pages cannot exceed the requested or operation-specific bound. All query paths reject non-advancing cursors. Traversal containment now requires a cursorless nonempty page to begin at depth 1 and forbids depth jumps greater than one, while allowing resumed pages to begin deeper. Provider diagnostics are allowlisted by export/search/traverse operation and cursor presence, preserving only diagnostics possible for that exact invocation. CLI and compiled verification now complete exports using only export pages and prove a cursor from history A fails closed with cursor-query-mismatch against different content at the same numeric generation in history B without canonical writes. Remediation evidence: focused Application suite 88 pass / 783 assertions; combined Application/CLI suite 131 pass / 1,321 assertions; bun run check 709 pass / 4,962 assertions including format, typecheck, boundaries, build, smoke, compiled workflow, same-generation continuity, and crash recovery; bun run check:targets verified all 4 standalone targets; git diff --check clean.

Final quality remediation completed. Public traversal now validates depth-1 roots against graphQueries.exactEntity after a traversal page succeeds: durable aliases may emit their canonical root, exact/traversal generations must match, and endpoint-valid hits from any other root still fail closed. Export supplies its already-canonical component root and avoids the extra exact lookup. Application coverage proves first and continued alias pages; the real CLI merge workflow traverses the obsolete durable alias and returns the survivor as from. Export also owns one incremental maxSnapshotStateValues budget across the final page envelope, component items, and relationships accumulated over internal traversal pages; a hostile two-page result that is safe page-by-page now fails before the second relationship is appended. Evidence: focused Application/CLI suite 132 pass / 1,333 assertions; bun run check 710 pass / 4,972 assertions including format, typecheck, boundaries, all tests, build, smoke, compiled workflow, and crash recovery; git diff --check clean.

External review on PR #31 found four actionable gaps on exact head 9999da9: export still lacked a fingerprint-pinned projection identity across internal queries; traversal containment did not verify deeper hits against the prior breadth-first frontier; internal relationship page size inherited the caller component limit and could make limit-1 export quadratic; and the expanded exact operations surface remained published as groma.operations/v1. The task is reopened for dependency-aware remediation and fresh local, CI, Claude, Codex, specification, and quality review.

PR #31 review remediation implemented without introducing a second semantic path. The official query boundary is now groma.graph-query/v2: callers capture one frozen generation/fingerprint identity through identity(), pass it explicitly to every data-bearing query, and consume a construction-captured maxPageSize. Persistence serves all partial reads under that expected identity and fails closed on generation or same-generation fingerprint drift. Application captures exactly one identity per export, search, or traversal; export reuses it for the component page and every internal outgoing traversal, sizes relationship pages by min(engine maxPageSize, remaining relationship allowance) independently of the component limit, and keeps the fingerprint internal. Cursorless traversal validates each deeper origin against the prior discovered frontier while resumed pages retain query-engine-owned cross-page continuity. Official capability IDs are groma.graph-query/v2 and groma.operations/v2 with no v1 adapters; Host accepts only the exact legacy v1 operations shape solely to capture initialize. Fixed-position search text may begin with --. Stable-ID and breadth-first ordering plus the updated continuity contract are documented across Core, Persistence, Application, Host, CLI, and ARCHITECTURE. Regression coverage includes one-identity flows, exact-content ABA and same-generation drift, stale-versus-query cursor precedence, fresh-process continuation, limit-1 relationship aggregation, hostile identity/page-size declarations, connected/disconnected/resumed traversal, exact v2 manifests, and legacy-init-only compatibility. Verification: focused Application/CLI 95 pass / 895 assertions; focused Host/Persistence/CLI 123 pass / 1,031 assertions; bun run check 718 pass / 5,049 assertions plus format, typecheck, boundaries, build, smoke, compiled workflow, and crash recovery; bun run check:targets verified all four standalone targets; git diff --check clean.

Post-audit verification correction: after descriptor-captured Application query metadata and its stable-maxPageSize regression were added, the final bun run check passed 718 tests / 5,051 assertions, bun run check:targets again verified all four standalone targets, and git diff --check remained clean.

Final review correction: createProjectionQueryEngine now proves at construction that Core's genuine bounded-query contracts accept its advertised maxPageSize and rejects incoherent bounds before projection reads. The mismatch regression, focused 149-test verification, and independent quality re-review passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Exposed deterministic bounded blueprint export, search, and relationship traversal through shared Application Operations and the CLI. Published groma.graph-query/v2 with explicit generation/fingerprint read identity and a truthful immutable page bound, published the expanded application surface as groma.operations/v2, kept legacy v1 operations initialization-only, and added bounded export aggregation, BFS containment, alias, restart, same-generation continuity, hostile-boundary, and plain/JSON parity coverage. Final verification: bun run check passed 721 tests with 5,065 assertions plus format, typecheck, architecture boundaries, build, smoke, compiled workflow, and crash recovery; bun run check:targets verified all four standalone targets; specification review PASS; quality review APPROVED; git diff --check clean.
<!-- SECTION:FINAL_SUMMARY:END -->
