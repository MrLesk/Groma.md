---
id: GROM-13
title: Implement deterministic Markdown intent persistence
status: To Do
assignee: []
created_date: '2026-07-11 17:34'
updated_date: '2026-07-11 17:36'
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
Persist standard-model groups and components as deterministic, human-readable Markdown under the canonical Groma workspace. The store owns curated intent only, shards by stable identity, preserves unknown extensions, and supplies exact content revisions for optimistic transactions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Groups and components round-trip between the standard model and readable Markdown without semantic loss
- [ ] #2 Canonical files are sharded and named by stable identity so renaming or regrouping does not change entity identity
- [ ] #3 Equivalent semantic state serializes to byte-identical output with deterministic field, embedded-item, relationship, extension, and file ordering
- [ ] #4 No volatile timestamps, absolute machine paths, evidence, bindings, or derived status are written into intent files
- [ ] #5 Unknown namespaced extensions survive load, unrelated mutation, and rewrite byte-stably where canonical normalization permits
- [ ] #6 Every loaded document has a deterministic content revision and malformed, duplicated, conflicted, or wrong-kind documents produce actionable diagnostics
- [ ] #7 Direct store APIs cannot bypass the standard model codec and do not receive scanner observations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define the 1A canonical directory and shard layout under groma.
2. Implement frontmatter and prose-body decoding through the standard model codec.
3. Implement deterministic serialization and stable content revisions.
4. Preserve unknown namespaced extensions while excluding non-intent planes.
5. Add golden round-trip, malformed-input, duplicate, conflict, rename, and determinism tests.
<!-- SECTION:PLAN:END -->
