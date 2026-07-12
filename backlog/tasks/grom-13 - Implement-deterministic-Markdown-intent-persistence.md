---
id: GROM-13
title: Implement deterministic Markdown intent persistence
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:34'
updated_date: '2026-07-12 12:32'
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
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Persist standard-model components as deterministic, human-readable Markdown under the canonical Groma workspace. Root and nested components use the same document model; the store owns curated intent only, shards by stable identity, preserves unknown extensions, and supplies exact content revisions for optimistic transactions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Root and recursively nested components, open types, structural parents, and ordinary relationships round-trip between the standard model and readable Markdown without semantic loss
- [ ] #2 Canonical files are sharded and named by stable identity so renaming, moving, or reparenting a component does not change entity identity
- [ ] #3 Equivalent semantic state serializes to byte-identical output with deterministic type, parent, field, embedded-item, relationship, extension, and file ordering
- [ ] #4 No volatile timestamps, absolute machine paths, evidence, bindings, or derived status are written into intent files
- [ ] #5 Unknown namespaced extensions survive load, unrelated mutation, and rewrite byte-stably where canonical normalization permits
- [ ] #6 Every loaded document has a deterministic content revision and malformed, duplicated, conflicted, cyclic, or wrong-kind documents produce actionable diagnostics
- [ ] #7 Direct store APIs cannot bypass the standard model codec and do not receive scanner observations
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
<!-- SECTION:NOTES:END -->
