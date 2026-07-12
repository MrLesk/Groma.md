---
id: GROM-15
title: Implement shared workspace and intent operations
status: Done
assignee:
  - '@codex'
created_date: '2026-07-11 17:35'
updated_date: '2026-07-12 22:37'
labels:
  - operations
milestone: m-1
dependencies:
  - GROM-9
  - GROM-10
  - GROM-11
  - GROM-13
  - GROM-14
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose one presentation-neutral application path for initializing a workspace and creating, reading, listing, updating, reparenting, and explicitly removing recursive standard-model components. Every mutation must use the same transaction, invariant, revision, persistence, and event contracts regardless of its future surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Initialization creates the minimal valid canonical Groma workspace transactionally and reports already-initialized or conflicting state without overwriting it
- [x] #2 Root and nested component create, exact read, bounded list and child traversal, sparse update, reparent, and explicit remove operations are available through typed presentation-neutral requests and results
- [x] #3 Component operations support open type, optional structural parent, intent prose, inputs, outputs, actions, ordinary relationships, lifecycle, desired state, and unknown extensions without requiring a complete component
- [x] #4 Every mutation accepts expected revisions where applicable, runs registered invariants, commits through the transaction engine and local journal, and returns the committed generation and new revisions
- [x] #5 All list and hierarchy operations implement the bounded query contract with deterministic ordering and opaque continuation
- [x] #6 No operation reads or writes Markdown, filesystem resources, or host state directly
- [x] #7 Operation-level tests run against both in-memory fault fixtures and the official local persistence composition and produce equivalent domain results
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define presentation-neutral workspace/component request, page, revision, mutation-outcome, and injected-capability contracts in src/application. Workspace initialization delegates to an atomic capability so the application layer does not freeze the local configuration format owned by GROM-16.
2. Build a validated Standard Model view from Core transaction-provider snapshots through injected GraphKernel and model capabilities. Map stable component IDs to opaque Core resource keys through an injected mapper; never import persistence implementations.
3. Implement exact component reads plus deterministic bounded all-component, root, child, and relationship pages with BoundedQueryContracts cursors bound to graph generation and query context. Use a bounded generation-retry handshake when a second snapshot is needed to attach page content revisions.
4. Implement root/nested create with minted or supplied stable identity and optional outgoing ordinary relationships. Normalize complete or sparse component data, mint relation identities through the graph capability, and commit one Standard Model transaction with expected absence.
5. Implement sparse update (including outgoing relationship upsert/removal), explicit reparent, and explicit leaf/relation-free remove. Require the current component revision, reject relation hijacking/cascade ambiguity before mutation, register all affected identities, and route every write through the injected TransactionEngine.
6. Translate Core outcomes into presentation-neutral component revisions, generations, affected identities, and typed diagnostics without resource locators or surface formatting. Keep indeterminate/provider/conflict states explicit.
7. Add a reusable operation conformance suite over an in-memory transaction provider, covering initialization idempotence/conflict, sparse and rich components, recursive same/mixed types, ordinary cross-branch relationships, pagination/cursors, revisions/conflicts, reparent, and explicit removal.
8. Run the same domain conformance cases through a host-boundary test composed with the real Local Resource Provider, Markdown store, journal, TransactionEngine, Standard Model invariant, graph, and query contracts; assert equivalent results and canonical restart persistence.
9. Run focused/full checks and all four targets, independent specification and quality reviews, then publish a ready task-linked PR and complete Claude/Codex/CI gates before finalization and merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L3 application boundary. GROM-15 must expose one presentation-neutral operation path over injected graph/query/transaction capabilities, keep Markdown/filesystem/host policy outside application code, and prove equivalent domain behavior with in-memory and official local persistence compositions. Discovery and final plan in progress.

Discovery decision: initialization is a semantic application operation over an injected atomic workspace capability; GROM-15 intentionally does not freeze YAML/configuration bytes or access local resources. Component relationships are scoped to outgoing relations owned by that component document. Explicit removal fails closed unless the component is a leaf with no incident ordinary relationships; this prevents implicit cascades and lets callers remove relations or reparent children through supported operations first. Read pages use Core bounded cursors and attach semantic component revisions without exposing storage locators.

Implementation completed in three reviewable slices. The application boundary now exposes injected-only initialization; exact component reads with bounded outgoing relationships; deterministic bounded all/root/child pages; root and nested create; sparse update with outgoing relationship upsert/removal; explicit reparent; and explicit leaf, relation-free removal. Every mutation builds the Standard Model transaction envelope, uses intent ownership with an empty pinned set, supplies exact component-resource revision expectations, and executes only through the injected transaction execution capability. Application results retain stable IDs, semantic generations, component revisions, and copied diagnostics while omitting resource keys and recovery resources/tokens.

A reusable provider-neutral conformance workflow exercises two roots, recursive same- and mixed-type containment, sparse and rich meaning, namespaced extensions and items, a cross-branch outgoing relation, all page families and continuation, sparse update, valid reparent, stale conflict/no change, explicit relationship cleanup, and leaf removal. The same normalized trace passes with the in-memory TransactionEngine plus registered Standard invariant and with the official local composition of LocalResourceProvider, MarkdownIntentStore, MarkdownIntentTransactionAdapter, LocalTransactionJournal, TransactionEngine, graph/query contracts, and Standard invariant. A fresh composition over the same local workspace confirms generation 10, identical five-component semantics and hierarchy, stable IDs, present revisions, zero remaining relationships, and five canonical Markdown documents. The workspace initializer remains an injected semantic test capability; no production configuration bytes or GROM-16 format were introduced.

Validation evidence: focused application+host tests 18 passed with 96 assertions; full bun run check 283 passed with 1,425 assertions including format, typecheck, architecture boundaries, build, and smoke; bun run check:targets verified Darwin arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64; direct src/application/index.ts compilation succeeded for bun-darwin-arm64, bun-linux-x64-baseline, bun-windows-x64-baseline, and bun-windows-aarch64. git diff --check and cumulative application-boundary import/leak review passed.

Specification-gap closure: initialization conformance now uses a reusable stateful atomic semantic fixture. It transitions absent state to a minimal empty canonical semantic workspace at generation 0, reports already-initialized on repetition, and reports conflict while preserving an incompatible sentinel unchanged. Both in-memory and official local-composition workflows exercise initialized then already-initialized; application tests separately prove conflict non-overwrite. The production capability remains representation-neutral and its contract now requires atomic establishment and preservation of conflicts.

Component resource mapping is now a strict diagnostic containment boundary. Every exact, page, create, update, reparent, and remove mapping call validates the capability result and replaces any failure, malformed result, or throw with one generic component-scoped diagnostic. Mapper messages, details, resource keys, and locators cannot escape. Initialization outcome validation now copies bounded optional Diagnostic details containing string, finite-number, and boolean scalars while rejecting malformed or accessor-bearing details without invocation.

Equivalence evidence now projects complete Standard Model semantics. The reusable trace reads the rich nested service back through getComponent and compares name, type, parent, intent, lifecycle, desired state, all input/output/action IDs, names, descriptions and extension values, component extension values, and both outgoing relationship descriptions and extension values before cleanup. Restart verification projects the same complete semantics for every remaining component, plus hierarchy, stable identities, present revisions, generation 10, and zero relationships.

Superseding validation evidence: focused application+host tests 22 passed with 119 assertions; full bun run check 287 passed with 1,448 assertions; bun run check:targets passed all four targets; direct src/application/index.ts compilation passed Darwin arm64, Linux x64 baseline, Windows x64 baseline, and Windows aarch64; architecture boundaries, formatting, typecheck, smoke, and git diff --check passed.

Quality hardening: automatic component identity planning now loads the validated canonical snapshot first and asks GraphKernel to mint against that graph, so configured collision retry observes existing identities; supplied identity conflicts remain explicit. Presentation diagnostics now use stable category messages and a bounded semantic-detail whitelist, preventing provider messages, ordinary string details, resource/locator/path text, and recovery tokens from escaping while retaining useful stable codes and opaque component/entity/relation identities. Committed outcomes are accepted only when their normalized affected entity and relation sets exactly equal the submitted transaction; response ordering differences normalize, while missing, extra, unrelated, or duplicate identities fail indeterminate.

ApplicationOperationsOptions now requires explicit bounded ceilings for components, relationships, relationship mutations, embedded items, diagnostic count, and snapshot structural values/depth, while constructor-enforced absolute ceilings also cap snapshot retries. Preflight checks reject hostile arrays, accessors, and proxies before unbounded copying, graph loading, identity generation, or transaction execution as applicable. Both in-memory and official local compositions use bounds compatible with their Standard invariant and store limits.

Superseding validation evidence: focused application+host tests 30 passed with 168 assertions; full bun run check 295 passed with 1,497 assertions; all four packaged targets passed; direct src/application/index.ts compilation passed Darwin arm64, Linux x64 baseline, Windows x64 baseline, and Windows aarch64; formatting, typecheck, architecture boundaries, build, smoke, and git diff --check passed.

Residual hardening completed: application diagnostics now expose capability/provider codes only when they match a lowercase kebab-case token capped at 128 characters; unsafe initialization, conflict, provider, validation, and indeterminate codes are replaced by stable application-owned category codes while existing message/detail/resource/recovery containment remains intact.

ApplicationOperationBounds now includes explicit maxRequestDataDepth and maxRequestDataValues limits with absolute constructor ceilings. Create and update copy their combined component/patch plus outgoing relationship data through the Core structural GraphData copier before model normalization/patching, identity allocation, graph/provider snapshots, relationship planning, or transaction execution. The shared total budget covers component extensions and embedded items plus relationship descriptions and extensions; hostile proxy inputs remain contained.

Superseding validation evidence: focused application+host tests 35 passed with 231 assertions; full bun run check 300 passed with 1,560 assertions; bun run check:targets verified Darwin arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64; direct src/application/index.ts compilation passed those same four targets. Formatting, typecheck, architecture boundaries, build, smoke, git diff --check, diagnostic secrecy review, and no-side-effect budget assertions passed.

Final review evidence at implementation commit 05be28e: independent specification and code-quality reviews passed; Claude approved with only non-blocking follow-up suggestions; PR #13 CI passed Quality gates and Cross-platform binaries; Codex completed with 👍 and no comments or review threads.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented one presentation-neutral workspace and recursive component operation layer over injected Core and Standard Model capabilities. Initialization, exact and bounded reads, root/nested create, sparse update, ordinary relationship changes, reparent, and explicit removal all share revision, invariant, transaction, journal, diagnostic-containment, and structural-budget semantics without importing host or persistence concerns. Verified by 35 focused tests with 231 assertions, the full 300-test/1,560-assertion check, all four supported compile targets, equivalent in-memory and official local persistence/restart conformance, independent specification and quality reviews, Claude approval, green CI, and Codex 👍 with no review threads.
<!-- SECTION:FINAL_SUMMARY:END -->
