---
id: GROM-99
title: Simplify canonical Markdown without weakening Groma invariants
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 18:38'
updated_date: '2026-07-21 19:26'
labels:
  - storage
  - simplicity
  - refactor
dependencies: []
references:
  - MANIFESTO.md
  - docs/interface-glossary.md
  - ../expert-career-path/editor/README.md
  - ../expert-career-path/roles/backend/Backend Developer.md
priority: high
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactor the official canonical Markdown representation and its direct read/write path so component files look like documents a thoughtful human would write by hand. Use frontmatter only for meaning that Markdown structure cannot express naturally, infer structure from headings, sections, lists, links, and deliberate folder conventions where safe, and avoid repeating machine-oriented identifiers or default values throughout visible prose. The Expert Career Path Markdown store is a directional reference for this restraint, not a format to copy: Groma is more complex and must retain stable opaque component identity, explicit shared meaning, intent/evidence separation, scanner blindness, deterministic atomic local writes, and fail-closed ambiguity. Keep this separate from the visual-blueprint task. Do not introduce a compatibility framework, generalized schema engine, fallback parser, or a new abstraction layer; prefer deleting representation machinery and composing the existing storage path directly. The supported boundary is canonical component Markdown and its reader/writer representation, not scanner observation contracts or visual layout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A canonical component file is understandable as ordinary Markdown, with frontmatter limited to stable identity and domain facts that have no clearer natural Markdown representation
- [x] #2 Component name, purpose or intent, items, containment, and relationships use readable headings, prose, lists, and links wherever those forms can express the meaning without ambiguity
- [x] #3 Every component retains one stable opaque identity that survives rename and move, while independently referenced nested items use short file-local identifiers rather than repeated long machine identifiers
- [x] #4 Shared meaning remains explicitly representable and round-trips deterministically; false, unset, derived, or default values are not serialized merely for completeness
- [x] #5 Machine evidence remains separate from curated intent and is not duplicated into human component prose or comments solely to reconstruct scanner output
- [x] #6 References resolve deterministically to stable identities and fail closed on duplicates, missing targets, ambiguous links, containment cycles, or other canonical ambiguity
- [x] #7 Canonical writes remain local, deterministic, readable, and atomic, and failed reads or writes never erase curated intent or the last complete blueprint
- [x] #8 The pre-release workspace can move to the simplified representation through one bounded rewrite without adding ongoing schema-migration or permissive legacy-parsing machinery
- [x] #9 The refactor preserves shared application-operation semantics for CLI, web, and export consumers while removing obsolete metadata, branches, helpers, tests, and concepts made unnecessary by the simpler format
- [x] #10 The groma init to groma scan to groma path remains complete using the simplified canonical files
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep the strict prose-first canonical Markdown codec with stable component identity, deterministic short file-local itemIds, and no legacy fallback.
2. Keep scanner evidence separate from curated component items and preserve the checked-in evidence snapshot while removing redundant projections.
3. Resolve stored parent and relationship targets through the existing alias graph when collecting rename dependents in application operations, reconciliation, and atomic materialization.
4. Reject unpaired surrogate escapes after inline decoding while accepting valid UTF-16 pairs.
5. Verify the bounded codec, application-operation, and reconciliation paths plus typechecking, formatting, and diff integrity.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one strict prose-first component Markdown representation. Stable component identity and irreducible domain metadata remain in YAML; name, purpose, items, containment, and relationships use readable Markdown. Long scanner-seeded nested identities remain stable through deterministic short file-local itemIds. The old v0.2 parser path, hidden metadata comments, base64 extension payloads, explicit false defaults, and compatibility machinery remain removed.

Scanner-observed members remain exclusively in evidence JSON; curated items are never patched by scans. The checked workspace contains 93 components and 278 relationships with zero canonical observation-member copies, while the raw observation snapshot remains unchanged.

Rename dependency collection now resolves stored parent and incoming relationship targets through the canonical alias graph in application operations, reconciliation, and the local atomic transaction adapter. A merge A→B followed by renaming B confirms revisions for the alias-backed child and incoming relationship owner, rewrites both labels atomically, preserves the child link destination A, and keeps the incoming relationship destination B. Inline decoding now rejects unpaired surrogate escapes with invalid-intent-unicode while accepting valid surrogate pairs.

Final bounded verification: bun test src/host/tests/application-operations-local.test.ts src/host/tests/reconciliation-local.test.ts src/persistence/tests/markdown-intent-store.test.ts passed 47 tests with 0 failures and 430 expectations. bun run typecheck passed. bun run format:check passed. git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Canonical Markdown remains prose-first, deterministic, evidence-separated, and migration-free. Alias-aware rename closure now atomically refreshes direct containment and incoming relationship labels after merges, and inline decoding fails closed on unpaired surrogate escapes. Final verification passed 47 focused tests (430 expectations), typechecking, formatting, and diff checks.
<!-- SECTION:FINAL_SUMMARY:END -->
