---
id: GROM-99
title: Simplify canonical Markdown without weakening Groma invariants
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 18:38'
updated_date: '2026-07-21 19:15'
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
1. Remove observed input, output, and action members from component projections and ownership updates while retaining complete observations and component bindings in evidence JSON; preserve every curated component item.
2. Rewrite the checked-in pre-release component documents to remove only observation-owned members, and canonicalize binding projections without member copies; keep the raw evidence snapshot unchanged.
3. Extend the existing local transaction composition to identify documents whose direct parent or relationship target label changes, reserialize only those affected documents, and require their logical revisions in the same atomic request.
4. Include those dependent component resources in application rename, merge, and reconciliation rename requests, without introducing a dependency framework or changing scanner contracts.
5. Add focused later-scan evidence-separation and rename-link assertions, then run targeted and proportional aggregate verification before restoring acceptance criteria and Done status.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one strict prose-first component Markdown representation. Stable component identity and irreducible domain metadata remain in YAML; name, summary, items, containment, relationships, and purpose use headings, prose, bullets, and stable-identity links. Removed the v0.2 schema marker, hidden HTML metadata comments, base64 extension payloads, explicit false defaults, and the legacy parser path. Long scanner-seeded nested identities are preserved once in an itemIds map while visible bullets use deterministic short file-local markers. The existing transaction adapter supplies reference labels and retains atomic publication, revision checks, and whole-graph validation. Rewrote all 93 checked-in canonical component documents once without a compatibility framework.

Objective verification: bun test passed 504 tests with 0 failures and 3142 expectations; bun run typecheck passed; bun run format:check passed; git diff --check passed. Direct loading of the rewritten tree produced 93 components and 278 relationships. A comparison against the exact pre-change tree found all 278 relationships and all nested item identities unchanged; the only entity differences were nine explicit shared:false values intentionally canonicalized to omission, with application reads treating omission as false. Focused coverage verifies prose round-trip, deterministic bytes, short local item markers with stable identity recovery, readable stable links, legacy rejection, ambiguity failures, bounded reads, and recursive loading. Existing CLI scan coverage exercises init, scan, and bare visual/export completion.

Unrelated baseline checks: bun run check:boundaries still reports pre-existing standard-model imports in unchanged src/cli/contracts.ts and src/cli/parser.ts. bun run verify:1a builds the executable successfully, then its existing static-export smoke sentinel fails because the compiled HTML does not include react-flow-dagre; renderer and build sources are outside this diff. These were not widened into GROM-99.

Terra P1 follow-up: reconciliation no longer turns observed input, output, or action records into canonical component items or ownership projections. Existing curated items are never patched by scans. The checked workspace rewrite removed 121 observation-owned item copies from 55 component documents and removed 122 redundant member copies from binding projections while preserving the raw evidence snapshot byte-for-byte at the parsed snapshot value. Strict evidence parsing now accepts only the separated projection shape; no legacy Markdown parser, migration framework, or fallback was added.

Readable-link follow-up: name changes now enumerate only direct children and incoming relationship owners, confirm their logical revisions, include them as affected resources, and let the existing transaction adapter reserialize those documents in the same atomic publication. The adapter compares prior and next label maps and relationship targets, so location-only descendants can still retain bytes while every stale containment or relationship label is refreshed. Merge and reconciliation rename requests include the same bounded dependent resources directly; no dependency engine was introduced.

Follow-up verification: the affected reconciliation, application-operation, and Markdown-store suites passed 46 tests; the affected CLI scan suite passed 5 tests. The single aggregate run passed 504 tests and exposed one obsolete CLI assertion that still expected observed routes in canonical actions; after correcting that assertion to verify zero canonical actions and 120 evidence actions, its complete 5-test suite passed. Typecheck, format check, and diff check passed. Strict checked-tree loading produced 93 components and 278 relationships with zero canonical member copies, one valid evidence source, and its raw observation snapshot unchanged. The old v0.2 rejection test passed, confirming no fallback. Follow-up delta: production +180/-200 (net -20), tests +105/-29 (net +76), 55 canonical documents -517 lines, and one evidence shard -720 redundant projection lines.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Canonical Markdown now excludes scanner-observed member evidence while preserving curated items and complete raw evidence JSON. Renames and merges atomically refresh every directly dependent containment and incoming relationship label with explicit logical revision coverage. Focused reconciliation/store/application/CLI suites, aggregate coverage, typechecking, formatting, strict checked-tree loading, and legacy-format rejection verify the fixes; the follow-up also removes a net 20 production lines and 1,237 duplicated document/evidence lines.
<!-- SECTION:FINAL_SUMMARY:END -->
