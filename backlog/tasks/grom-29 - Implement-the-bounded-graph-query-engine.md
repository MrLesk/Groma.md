---
id: GROM-29
title: Implement the bounded graph query engine
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:57'
updated_date: '2026-07-16 23:27'
labels: []
milestone: m-2
dependencies:
  - GROM-28
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - ARCHITECTURE.md
  - src/core/README.md
  - src/core/graph-query.ts
  - src/core/index.ts
  - src/core/projection.ts
  - src/core/query.ts
  - src/core/tests/query-events.test.ts
  - src/host/README.md
  - src/host/bootstrap-configuration.ts
  - src/host/contracts.ts
  - src/host/default-bootstrap.ts
  - src/host/default-host-identities.ts
  - src/host/lifecycle.ts
  - src/host/tests/bootstrap-configuration.test.ts
  - src/host/tests/default-bootstrap.test.ts
  - src/host/tests/lifecycle.test.ts
  - src/host/tests/plugin-sdk-conformance.test.ts
  - src/persistence/README.md
  - src/persistence/index.ts
  - src/persistence/local-resource-provider.ts
  - src/persistence/local-transaction-journal.ts
  - src/persistence/projection-index.ts
  - src/persistence/projection-query-engine.ts
  - src/persistence/projection-read-index.ts
  - src/persistence/tests/local-transaction-journal.test.ts
  - src/persistence/tests/projection-index.test.ts
  - src/persistence/tests/projection-query-engine.test.ts
priority: high
type: feature
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Answer useful architectural questions through deterministic pages and subgraphs so users and agents can explore a large blueprint without loading the entire graph.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Queries support exact entities, filtered component pages, full-text search, and relationship traversal by direction, type, and bounded depth
- [x] #2 Every result is deterministically ordered, generation-aware, bounded by validated limits, and resumable with an opaque cursor
- [x] #3 A cursor used against the wrong query or a changed generation fails with the documented cursor diagnostic
- [x] #4 Inbound and outgoing relationships can be queried without reading every component document
- [x] #5 Equivalent rebuilt and incrementally updated projections return semantically identical pages
- [x] #6 The engine does not require callers or Core to know the projection storage technology
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep the storage-neutral Core graph-query and projection-read contracts bounded, deterministic, generation/fingerprint-aware, cursor-safe, and independent from Persistence storage.
2. Keep the complete ProjectionIndexCapability as the reconstructable materialization boundary; publish manifest-last Merkle-authenticated bounded resources and journal continuity only after successful publication.
3. Implement exact, filtered, search, and bounded directional traversal over ProjectionReadCapability with validated budgets, resumable opaque cursors, exact anchor checks, one bounded entity batch, and hostile-provider containment; when a range-selected catalog or relation chunk lacks the requested anchor, return anchor mismatch immediately because later strictly ordered chunks cannot contain it.
4. Give ProjectionIndexCapability and ProjectionReadCapability distinct Host capability identities. The official projection plugin publishes both interfaces, the application consumes only the complete index identity, and the query plugin consumes only the bounded-read identity; conformance must reject missing partial-read methods before startup succeeds.
5. Make every partial-read result, including exact entity-or-alias reads, echo the requested projection identity and reject replacement-provider identity drift before graph results are stamped.
6. Preserve cursor contract precedence and resumability: validate cursor generation/query binding before traversal root resolution can mask it, generation mismatch wins over simultaneous root removal or query/fingerprint change, wrong same-generation queries still fail binding, and no engine page emits a cursor above its own accepted bound.
7. Translate replacement-provider diagnostics only in the operation where they are semantically valid: exact entity unknown maps to unknown-entity, exact catalog anchor absence maps to cursor-anchor-mismatch, and unexpected cross-method diagnostics fail closed as graph-query-unavailable.
8. Keep stale-bundle cleanup bounded and deletion-safe while enumerating bundle roots and stale subtrees separately so the current bundle cannot consume the stale-file removal budget; do not add the empty-directory reclamation deferred to GROM-53.
9. Preserve the documented continuity boundary: each fresh Host validates canonical state once, supported transactions invalidate projection continuity, and concurrent raw Markdown mutation behind a running Host remains unsupported; reopening catches direct edits without forcing full canonical reads per bounded query.
10. Add focused Host, conformance, provider, identity, negative-anchor, traversal-removal, diagnostic-routing, and cursor regressions and documentation, then run focused tests, the complete quality gate and all four targets before independent review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context Hunter classification: L2/high-risk public cross-layer read capability. Independent design review rejected the initial whole-snapshot adapter because it could not satisfy AC4 or the large-graph goal: that approach hydrated the complete projection and re-read canonical Markdown per query. The final implementation therefore adds a bounded projection-read boundary and manifest-last local query bundle while retaining the complete projection JSON only as a reconstructable materialization boundary. The tracked projection continuity marker is operational generation, canonical fingerprint, Merkle integrity root, and exact resource-count metadata, never architectural meaning. Normal reads touch only bounded catalogs and exact shards; genesis, legacy state, direct canonical edits, marker lag, branch switches, and partial or crashed publication fail closed or perform one complete validation and rebuild before serving.

Final verification passed: bun run check completed formatting, TypeScript, architecture boundaries, 673 tests with 4,630 assertions, build, smoke, and Iteration 1A verification. bun run check:targets verified the four supported standalone executable targets and restored the native artifact. The independent no-edit reviewer returned PASS after rerunning selective provider-array iterator and helper-prototype poisoning exploits and reviewing query semantics, Host composition, Merkle continuity, publication ordering, recovery, and legacy migration.

Claude review on PR #30 found five independently relevant gaps after the first green gate: preserve legacy pending journal token encoding across failed roll-forward retry, validate forged catalog cursor anchors against the exact filtered result set, descriptor-capture partial-read requests once, repair deletion-safe multi-page bundle cleanup, and align official publisher/query NFKC budgets. The task is reopened until regressions, independent PASS, full gates, amended single commit, and final-head Claude review all pass.

Post-Claude remediation is complete. Regression coverage now proves byte-exact legacy pending-token retry and settlement migration, rejection and prototype-safe handling of the internal legacy marker, exact filtered/search cursor-anchor membership, one-time descriptor capture of partial-read requests, deletion-safe cleanup across multiple enumeration pages, and post-NFKC/lowercase searchable-text limits. The same independent no-edit reviewer returned a final PASS with no findings after inspecting all five areas and running 105 focused tests with 632 assertions. Final repository verification passed: bun run check completed formatting, TypeScript, architecture boundaries, 678 tests with 4,660 assertions, build, smoke, and Iteration 1A verification; bun run check:targets verified all four supported standalone executable targets and restored the native artifact.

Final-head Claude review found no blocking correctness defect and independently validated Merkle proofs, cursor binding, crash-safe activation, hostile-provider containment, and Host registration completeness. It identified unchanged cold-start bundle republication, prefix-rescanning cursor resume, per-result continuity/catalog rereads, weak Host assertions/checkpoint seam coverage, and a hidden provider-page/shard-size coupling. GROM-29 is reopened because scale failure and resumable bounded provider-neutral pages are task invariants; remediation is constrained to an explicit repair-safe activation path, exact anchor validation, one bounded same-identity entity batch, page/chunk bound separation, and focused Host regressions—no generalized query planner or cache.

Final-head scale and continuity remediation is complete. Unchanged durable bundles are adopted without republication, cursor resume validates one exact filtered anchor and starts at the suffix, and result materialization uses one bounded same-identity entity batch. Public page size is independent from the Persistence-private fixed 100-item shard size. Forced repair is internally branded only for authenticated missing, oversized, malformed, or proof-invalid projection resources; malformed or stale identities, request, checkpoint, continuity, provider, and infrastructure failures cannot publish. Expected identities are captured once before I/O with prototype-poisoning and deferred A-to-B mutation regressions. Checkpoint-backed adoption is provisional until ignore hygiene succeeds, while checkpoint failure remains zero-write and failed hygiene leaves reads unauthorized. The independent no-edit reviewer returned PASS on the complete delta. Final repository verification passed: bun run check completed formatting, TypeScript, architecture boundaries, 686 tests with 4,749 assertions, build, smoke, and Iteration 1A verification; bun run check:targets verified all four supported executable targets and restored the native artifact.

Final-head Claude review reproduced four task-relevant correctness failures: default maximum search context and cursor bounds reject valid input; an oversized disposable current manifest cannot self-heal; direct relationship paging repairs an unknown entity; and checkpoint contention is misclassified as stale continuity and triggers canonical work. Remediation follows the independent review design: one derived shared 2,504-character query-context ceiling and 3,511-character cursor ceiling, typed visible/rebuildable/unavailable projection state, exact catalog absence before adjacency repair, and fail-closed checkpoint infrastructure handling. Hierarchical empty-directory reclamation is real but remains best-effort and is deferred to organization-scale validation in GROM-53; GROM-29 only fixes bounded cleanup so collected removals are not discarded when a cap is reached.

Final bounded-remediation verification is complete. The official query context and cursor ceilings are derived once (2,504 and 3,511 characters) from every public maximum plus worst-case JSON and cursor encoding, with exact boundary and Host 32-term regressions. Projection visibility now distinguishes reconstructable manifest/checkpoint state from provider or checkpoint infrastructure failure; oversized disposable manifests self-heal, warm checkpoint failure performs no canonical reload or publication, unknown relationship roots never enter repair, and known missing adjacency still repairs once. Cleanup remains bounded and best-effort, but reaching a cap removes already-collected stale files; empty provider namespace and legacy-directory reclamation remains deferred to GROM-53. The same independent no-edit reviewer returned PASS with no actionable blockers. Final verification: bun run check passed formatting, TypeScript, architecture boundaries, 690 tests with 4,786 assertions, build, smoke, and Iteration 1A; bun run check:targets verified all four supported executable targets and restored the native artifact.

Final-head Claude review on e15adb2 found four independently reviewable issues: percent-encoded BMP strings can expand cursor fields by 9x rather than the derived 8x; stale-bundle cleanup can request a per-directory enumeration cap above the official provider's configured default; checkpoint read/record release can reject despite the Result contract; and checkpoint reads may contend on the parked exclusive transaction lease. The task is reopened while each claim is independently validated and the smallest coherent remediation is implemented.

Final Claude delta remediation is complete. Cursor sizing now uses the exact 3,864-character percent-encoded worst case: a literal three-byte BMP code unit expands to three percent triplets, while term boundaries replace raw whitespace at the same nine-character cost. The official local provider's 10,000-entry directory default is shared with stale-bundle cleanup so larger projection bounds cannot create an invalid official cleanup request. Checkpoint read and record operations compute their Result before guarded release; throwing, retryable, and ownership-lost release failures remain contained, successful work with release uncertainty reports projection-checkpoint-unavailable, and earlier specific generation failures are preserved. Exclusive prepared-transaction checkpoint contention remains deterministic fail-closed and is explicitly deferred to GROM-31. The same independent no-edit reviewer returned PASS with no blockers or scope drift. Final verification: bun run check passed formatting, TypeScript, boundaries, 693 tests with 4,806 assertions, build, smoke, and Iteration 1A; bun run check:targets verified all four supported targets.

Exact-head spec review disposition: the old long-lived raw-Markdown comment is not actionable because ARCHITECTURE.md and src/persistence/README.md explicitly define concurrent direct mutation behind a running Host as unsupported; supported transactions invalidate continuity and reopening validates direct edits. The separate-capability comment is actionable: the Host currently identifies both ProjectionIndexCapability and ProjectionReadCapability as groma.projection-index/v1, allowing composition to accept an index-only replacement and fail later at query time. Remediation separates the identities and proves composition/conformance.

Exact-head review follow-up confirmed four additional acceptance-contract defects: current-bundle enumeration can starve bounded stale-file cleanup; exactEntity lacks the identity envelope used by every other partial read; simultaneous generation/fingerprint changes can mask stale-cursor as query mismatch; and independently configured cursor budgets can let the engine emit a cursor it rejects on resume. Remediation remains narrow: separate root/stale enumeration, ProjectionReadExact wrapping and engine verification, generation-first cursor validation, and an outgoing engine cursor-bound check.

Final exact-head remediation is implemented. Host capability identity now separates groma.projection-index/v1 from groma.projection-read/v1; the official projection publishes the same object under both while application and query consumers require only their respective contracts. Partial exact reads now echo and validate projection identity. Cursor validation gives generation drift precedence and the engine refuses to emit a cursor above its own bound. Stale cleanup enumerates bundle roots separately from bounded stale subtrees so the current bundle cannot starve removals. Focused verification passed 154 tests with 966 assertions. Full bun run check passed formatting, TypeScript, boundaries, 696 tests with 4,824 assertions, build, smoke, and Iteration 1A crash recovery. bun run check:targets verified all four standalone targets and restored the native artifact. Final diff self-review found no scope drift or unresolved correctness concern; the documented unsupported concurrent raw-Markdown boundary is unchanged.

Fresh spec review reproduced one remaining AC3 ordering defect at amended head 15832b2: traversal resolves the root before validating a continuation cursor, so advancing generation while deleting the root returns unknown-entity instead of stale-cursor. Remediation must validate the bound cursor before root lookup without weakening alias traversal semantics or same-generation query/fingerprint binding.

AC3 traversal ordering remediation is complete. Traversal cursors are now bound to the validated user-requested query and checked against current projection identity before alias or root resolution; the resolved canonical entity is used only for traversal execution. Regression coverage proves canonical resume, alias resume, stale-cursor precedence when generation and fingerprint advance while the root is removed, and cursor-query-mismatch for a wrong same-generation traversal. Focused Core/query-engine verification passed 51 tests with 238 expectations. bun run check passed formatting, TypeScript, architecture boundaries, 696 tests with 4,827 expectations, build, smoke, and Iteration 1A crash recovery. bun run check:targets verified all four standalone targets and restored the native artifact. Final self-review found no second cursor parser, storage coupling, alias regression, scope drift, or unresolved correctness concern.

Independent code-quality review at a4bc630 found one Important hostile-provider issue: generic providerFailure translates projection-read-anchor-mismatch and unknown-entity for every provider method. This lets exactEntity surface cursor-anchor-mismatch and exactCatalogEntry during cursor resume surface unknown-entity. Remediation scopes public diagnostic translation to the calling operation and collapses unexpected method diagnostics to graph-query-unavailable, with cross-method regressions.

Hostile-provider diagnostic routing remediation is complete. The existing provider result boundary now receives one explicit operation mode for identity, exact entity, exact catalog anchor, exact entity batch, catalog page, or relation page. Exact entity translates only unknown-entity; exact catalog translates projection-read-anchor-mismatch or unknown-entity to cursor-anchor-mismatch; any mixed, unexpected, or cross-method diagnostic fails closed as graph-query-unavailable. Regressions cover both reproduced leaks, both valid exact-catalog absence forms, valid exact-entity absence, and fail-closed identity, batch, catalog-page, and relation-page failures. Focused query-engine verification passed 20 tests with 90 expectations; TypeScript passed. bun run check passed formatting, TypeScript, architecture boundaries, 697 tests with 4,835 expectations, build, smoke, and Iteration 1A crash recovery. bun run check:targets verified all four standalone targets and restored the native artifact. Final self-review found no diagnostic leak, storage coupling, public-contract expansion, scope drift, or unresolved correctness concern.

Final-head Claude review approved with no blocking correctness defect and independently validated cursor ceilings/precedence, alias traversal, Merkle publication, recovery, and provider containment. Of four efficiency/coherence observations, negative-anchor suffix scanning is task-relevant: after the only range-selected catalog/relation chunk lacks an anchor, strict non-overlap proves later chunks cannot contain it, yet current code scans the suffix. Fix this bounded-read violation with immediate mismatch and read-count regressions. Transaction-token projection metadata remains operational pending-state integrity evidence rather than canonical blueprint meaning, so removing it is rejected. Double continuity reads are related to the concurrency/lease work in GROM-31, and duplicate normalization is a non-blocking optimization; neither is pulled into GROM-29.

Final approved bounded-read improvement is complete. Catalog and relation paging now return projection-read-anchor-mismatch immediately after the single range-selected chunk is Merkle-verified, decoded, strictly ordered, count-checked, endpoint-matched, and found not to contain the requested anchor. Valid anchor paging and before-first/after-last handling are unchanged. One sparse 201-edge fixture publishes three catalog and three relation chunks; provider read observation proves each in-range absent anchor reads only the selected 00000000.json data chunk and never either later chunk. Focused projection-index verification passed 35 tests with 268 expectations. bun run check passed formatting, TypeScript, architecture boundaries, 698 tests with 4,844 expectations, build, smoke, and Iteration 1A crash recovery. bun run check:targets verified all four standalone targets and restored the native artifact. Final self-review found no diagnostic change, proof-order weakening, valid-page regression, out-of-scope transaction/continuity/normalization change, scope drift, or unresolved correctness concern.

GitHub Actions run 29541027897 failed only because two filesystem-heavy projection tests exceeded Bun’s 5 s Linux per-test limit: the existing 102-child cross-chunk fixture at 5.060 s and the new 201-child negative-anchor fixture at 5.044 s. Both binary jobs passed and local full gates were green. CI remediation reuses one minimal 102-child sparse cross-chunk publication for valid continuation, batch, and negative-anchor read-count assertions, removing the duplicate 201-child publication rather than raising timeouts or weakening behavior coverage.

Linux timeout remediation is complete without changing production code or test timeouts. The existing minimal 102-child star fixture now uses sparse even entity and relation IDs and one observed resource provider. Its single publication retains the small-page, 101-item cross-private-chunk catalog, exact-batch, relation, and valid continuation assertions, and now also proves in-range missing catalog and relation anchors return projection-read-anchor-mismatch after exactly one selected data-chunk read. The separate 201-child fixture/test and its second publication were removed. Three consecutive focused runs passed in 1.565 s, 1.531 s, and 1.526 s with 18 expectations each. bun run check passed formatting, TypeScript, architecture boundaries, 697 tests with 4,841 expectations, build, smoke, and Iteration 1A crash recovery; total test time was 14.93 s locally versus 18.24 s before consolidation. bun run check:targets verified all four standalone targets and restored the native artifact. Final self-review found no production change, coverage weakening, timeout increase, scope drift, or unresolved correctness concern.

GitHub Actions run 29541525860 confirmed the consolidated mathematically minimal 102-child test alone reaches 5.048 s on the shared Linux runner despite three local runs at ~1.5 s. The timeout fires before the relation-tail assertion and causes the observed zero-length unhandled follow-on; no product assertion fails before cancellation. Since further fixture reduction would no longer cross the fixed 100-item storage chunk, apply one explicit 10 s timeout only to this filesystem integration test, with no global timeout or behavior change.

Second shared-Linux timeout remediation is complete. The mathematically minimal 102-child filesystem cross-chunk integration test alone now has Bun’s explicit 10,000 ms local timeout; no global timeout, production code, fixture cardinality, or assertion changed. TypeScript passed. Three focused runs passed in 1.605 s, 1.609 s, and 1.586 s with 18 expectations each. bun run check passed formatting, TypeScript, architecture boundaries, 697 tests with 4,841 expectations, build, smoke, and Iteration 1A crash recovery; an additional complete test run passed in 15.11 s. bun run check:targets verified all four standalone executable targets and restored the native artifact. Final self-review confirmed the remediation is limited to the named test timeout plus this task evidence, with no production or global configuration change.

Final exact-head verification completed at b86ca97. GitHub Actions run 29541866128 passed Cross-platform binaries, Native Windows binary, and Quality gates. Independent final spec and code-quality reviews approved the targeted 10 s timeout on the mathematically minimal cross-private-chunk filesystem integration test; production code, fixture cardinality, assertions, and global timeout configuration are unchanged. The worktree is clean and the PR remains one amended commit over GROM-28.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Codex
created: 2026-07-16 04:24
---
Reopened after the latest Linux quality-gate run exposed a 5 s timeout in a filesystem-heavy cross-chunk regression. The implementation is correct; the fixture will be reduced to the smallest graph that still proves traversal across the fixed 100-item storage boundary.
---

author: Codex
created: 2026-07-16 04:27
---
Linux CI timeout remediation complete. The reduced 102-child fixture is the minimal graph that lets a 101-item public page cross the private 100-item chunk and retain a nonempty continuation tail. Three repeated focused runs completed in about 1.6 s; the independent no-edit reviewer returned PASS; bun run check passed 693 tests with 4,806 assertions; bun run check:targets passed all four targets.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the storage-neutral bounded graph query engine for exact and alias reads, filtered component pages, NFKC full-text search, and directional typed bounded traversal. The engine provides deterministic generation-aware opaque cursors, strict query binding and stale-generation precedence, bounded provider-neutral pages and batches, operation-scoped hostile-provider diagnostics, and distinct projection-index versus projection-read Host capabilities. Persistence publishes manifest-last Merkle-authenticated reconstructable query resources, validates identity on every partial read including exact entities, adopts valid durable bundles without republication, repairs only authenticated reconstructable failures, and performs bounded deletion-safe stale cleanup. Focused regressions cover cursor ceilings, anchors, aliases, traversal, generation drift, diagnostic routing, cleanup, publication recovery, checkpoints, hostile providers, and cross-private-chunk continuation. Final verification passed bun run check with 697 tests and 4,841 expectations, bun run check:targets for all four standalone targets, GitHub Actions run 29541866128, and independent final spec and code-quality review.
<!-- SECTION:FINAL_SUMMARY:END -->
