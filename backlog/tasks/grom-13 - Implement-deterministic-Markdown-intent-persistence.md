---
id: GROM-13
title: Implement deterministic Markdown intent persistence
status: Done
assignee:
  - '@codex'
created_date: '2026-07-11 17:34'
updated_date: '2026-07-12 13:25'
labels:
  - persistence
  - markdown
milestone: m-1
dependencies:
  - GROM-8
  - GROM-12
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
documentation:
  - ARCHITECTURE.md
  - src/persistence/README.md
modified_files:
  - ARCHITECTURE.md
  - bun.lock
  - package.json
  - src/persistence/README.md
  - src/persistence/index.ts
  - src/persistence/markdown-intent-store.ts
  - src/persistence/tests/markdown-intent-store.test.ts
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Persist standard-model components as deterministic, human-readable Markdown under the canonical Groma workspace. Root and nested components use the same document model; the store owns curated intent only, shards by stable identity, preserves unknown extensions, and supplies exact content revisions for optimistic transactions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Root and recursively nested components, open types, structural parents, and ordinary relationships round-trip between the standard model and readable Markdown without semantic loss
- [x] #2 Canonical files are sharded and named by stable identity so renaming, moving, or reparenting a component does not change entity identity
- [x] #3 Equivalent semantic state serializes to byte-identical output with deterministic type, parent, field, embedded-item, relationship, extension, and file ordering
- [x] #4 No volatile timestamps, absolute machine paths, evidence, bindings, or derived status are written into intent files
- [x] #5 Unknown namespaced extensions survive load, unrelated mutation, and rewrite byte-stably where canonical normalization permits
- [x] #6 Every loaded document has a deterministic content revision and malformed, duplicated, conflicted, cyclic, or wrong-kind documents produce actionable diagnostics
- [x] #7 Direct store APIs cannot bypass the standard model codec and do not receive scanner observations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define persistence-local Markdown intent contracts, configured bounds, stable diagnostics, exact SHA-256 content revisions, and the canonical groma/intent/<two-hex-shard>/<entity-id>.md locator/resource mapping. Keep the Local Resource Provider and Standard Model capability injected so filesystem and model policy stay behind their boundaries.
2. Pin yaml 2.9.0 and implement a deterministic groma/v0.1 codec. Store one component per file, keep intent in a reversible # Intent Markdown body, store outgoing relationships with stable IDs in frontmatter, order all known fields/items/relationships/extensions deterministically, and hash exact UTF-8 bytes.
3. Decode bounded frontmatter with duplicate-key, conflict-marker, schema, kind, identity, relationship, and GraphData validation. Route components through StandardModelCapability normalize/parse/serialize and relationships through its semantic view so direct store APIs cannot bypass the standard codec.
4. Implement provider-backed exact reads and bounded whole-store loads. Enumerate only the canonical two-level shard layout, treat a missing intent root as empty, enforce document/directory/byte ceilings, return stable entity/relation order, and diagnose wrong locations, duplicate identities, unknown parents/targets, cycles, malformed resources, and unexpected kinds.
5. Preserve unknown namespaced component, item, and relationship extensions through load, unrelated model mutation, and canonical rewrite while never adding evidence, bindings, aliases, plans, timestamps, machine paths, or derived status.
6. Add boundary-local golden and temporary-provider tests for root/nested components, same/mixed recursive containment, relationships, Unicode/prose fidelity, stable rename/reparent locations, semantic determinism, exact revisions, extension preservation, empty stores, bounds, conflicts, duplicates, wrong kind/location, missing endpoints, cycles, and malformed YAML.
7. Run focused/full checks plus direct persistence compilation for macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64; complete independent specification then quality review, publish a ready task-linked PR, run Claude for text/naming/simplicity, and wait for Codex acceptance/comments before finalization and merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L2 canonical-format and public persistence-contract change. The existing architecture example, Standard Model capability, Core revision types, and Local Resource Provider are the controlling patterns. Canonical layout is groma/intent/<first two entity hex digits>/<stable entity id>.md, so rename/reparent never changes identity or resource. One file owns one component and its outgoing stable-ID relationships; relationship source is implicit in the owning document. Intent is stored reversibly beneath a # Intent body heading; exact loaded bytes determine sha256 content revisions. Provider-backed reads/loads are implemented here, while mutation/transaction orchestration remains GROM-14 so no direct canonical write path bypasses Core transactions. Current Context7 documentation for /eemeli/yaml confirms parseDocument error/warning inspection, uniqueKeys, schema selection, and deterministic toString controls including lineWidth and sortMapEntries. Registry latest is yaml 2.9.0, which will be pinned exactly.

Implemented the deterministic Markdown intent codec and bounded provider-backed reader/loader. The public boundary exposes serialize/decode/read/load only, routes component and relationship semantics through the injected Standard Model capability, uses stable-ID shards and exact SHA-256 byte revisions, preserves namespaced extensions, and diagnoses malformed YAML/UTF-8/framing, conflicts, wrong schema/kind/location, duplicates, missing references, cycles, bounds, and unexpected layout. Updated persistence exports/README and the ARCHITECTURE example. Validation: focused Markdown intent suite 19 passed (71 assertions); bun run check 204 passed (924 assertions); bun run check:targets passed all 4 targets; direct persistence-index compilation passed darwin-arm64, linux-x64-baseline, windows-x64-baseline, and windows-arm64; git diff --check passed.

Specification follow-up: serialization now rejects unpaired UTF-16 surrogates anywhere in intent/frontmatter/nested GraphData with invalid-intent-unicode before UTF-8 encoding; Git conflict diagnostics require a complete ordered conflict block so legitimate separator prose round-trips; canonical intent-bearing framing now matches the architecture example with one blank line between the closing delimiter and # Intent. Added a full canonical-byte golden, explicit malformed-YAML coverage, and four-level same-type/mixed-type containment through provider load. Validation: focused Markdown intent suite 22 passed (88 assertions); bun run typecheck passed; git diff --check passed.

Quality hardening follow-up: enabled yaml 2.9 intAsBigInt parsing, converts only exact safe integers, and rejects unsafe integer/float-integer, non-finite overflow/NaN, and underflowed numeric values before Standard Model use, including nested component/item/relation extensions. Added maxTotalDocumentBytes with a 128 MiB default and 1 GiB absolute ceiling, incremental exact-byte accounting before decode/retention, and intent-total-byte-limit-exceeded. Direct entity/relation serialization now snapshots descriptor-inspected exact records and arrays without invoking accessors; proxy inspection failures remain typed Results. Missing intent root is empty only on the first enumeration request; disappearance after a successful page returns intent-load-inconsistent. Validation: focused Markdown intent suite 26 passed (113 assertions); bun run typecheck passed; git diff --check passed.

Final specification numeric/input follow-up: exact integer lexemes outside Number's safe range now convert when finite Number conversion is exactly reversible via BigInt(converted) === original, while inexact or overflowing integer lexemes still fail closed. Finite YAML float/exponent scalars retain Core's IEEE Number semantics, including 9007199254740992 and 1e100; non-finite and nonzero-underflow values remain rejected. Descriptor-inspected entity and relation payloads are now copied through Core before Standard Model calls, so nested accessors/aliases cannot throw or change during serialization. Validation: focused Markdown intent suite 27 passed (119 assertions); bun run typecheck passed; git diff --check passed.

Final numeric emission quality fix: canonical serialization now wraps every finite integer-valued Number outside the safe-integer range in an untagged yaml Scalar with EXP format. This prevents yaml from emitting ambiguous plain integer lexemes while preserving the decoder's strict rejection of user-authored inexact integers. Regressions cover 1000000000000000100, 1.2345678901234568e20, the negative counterpart, nested component/item/relation extensions, no explicit !!float tag, and byte-identical rewrite. Validation: focused Markdown intent suite 27 passed (124 assertions); bun run typecheck passed; git diff --check passed.

Claude/Codex review fixes: serialize now rejects complete column-zero Git conflict blocks with intent-conflict-marker while lone separator prose remains valid. Intent bytes use intrinsic typed-array tag/buffer/offset/length inspection and raw-buffer copies, accepting Buffer/Uint8Array subclasses without species or subclass constructors, rejecting wrong typed arrays/proxies, and returning isolated plain Uint8Array snapshots whose mutation cannot invalidate revisions. The __proto__ regression now proves an own data property survives. Bounded loads reject empty non-final pages and cap pages at maxDocuments + 256 shards + one terminal page. Validation: focused Markdown intent suite 30 passed (144 assertions); bun run typecheck passed; git diff --check passed.

Final validation at 8750d421d252bdddf31c9016f72e276bd3f93aaa: bun run check passed 215 tests with 997 assertions; bun run check:targets passed macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64; independent specification and quality reviews passed. Ready PR #11 passed both CI jobs. Claude review and Codex review of 3ac6ffc were independently assessed and their actionable findings were fixed; Codex exact-head retry produced only a service usage-limit notice, not new code feedback.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the deterministic groma/v0.1 Markdown intent store with stable-ID sharding, reversible prose, outgoing relationships, exact revisions, bounded provider loading, strict lossless YAML/numeric handling, graph diagnostics, extension preservation, and defensive runtime copying. Documented the canonical format and verified it with 30 focused tests, the full 215-test suite, independent spec/quality review, ready PR review, CI, and all four supported Bun binary targets.
<!-- SECTION:FINAL_SUMMARY:END -->
