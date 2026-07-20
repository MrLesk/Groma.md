---
id: GROM-72
title: Store each component as a readable named document file
status: Done
assignee:
  - '@codex'
created_date: '2026-07-20 17:44'
updated_date: '2026-07-20 19:53'
labels:
  - pivot
  - persistence
milestone: m-5
dependencies:
  - GROM-71
references:
  - ../expert-career-path/editor/server/store.mjs
priority: high
type: feature
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Persistence v0.2 for the intent plane: one Markdown file per component, filename derived from the component name, in folders that mirror the parent hierarchy — replacing hash-sharded intent/<xx>/ent_<hash>.md files whose 55-line frontmatter buries one line of prose. Identity always comes from the stable id carried in the file, never from the filename or a name slug (the expert-career-path editor proves the readable-file model and also demonstrates the slug-identity flaw Groma must not copy). Rename or reparent moves the file in the same transaction. Frontmatter stays minimal (schema, id, and only the structural fields that are present); intent reads as prose; items and relationships render as readable bullets carrying stable short ids in HTML comments so references survive text edits invisibly. Sibling filename collisions fail closed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A component persists as one Markdown file named from its name inside folders mirroring its parent chain, and rename or reparent moves the file in the same transaction
- [x] #2 Identity always comes from the stable id in the file; a hand-moved or hand-renamed file never changes identity
- [x] #3 Frontmatter is minimal and prose-first: intent, items, and relationships render as readable Markdown with stable short ids in HTML comments
- [x] #4 Serialization is deterministic and byte-stable; sibling filename collisions fail closed with an actionable diagnostic
- [x] #5 Every existing operation keeps working through shared application operations and bun run check stays green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define a v0.2 prose-first component document codec with minimal frontmatter and stable short IDs in readable bullets.
2. Replace hash-derived intent locations with deterministic filesystem-safe names under a parent-mirroring component tree, while stable identity continues to come only from document content.
3. Make transaction materialization compute old and new document locations from the complete canonical graph so rename/reparent moves—including descendants—are atomic and sibling path collisions fail closed.
4. Update shared resource mapping and affected operation tests without changing semantic operations or the standard model.
5. Add focused codec/location/collision/move coverage, update persistence docs, and run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the v0.2 readable component plane under groma/components: minimal structural frontmatter, prose/item/relationship Markdown sections with stable IDs in HTML comments, name-derived hierarchy paths, stable content identity, fail-closed portable sibling collisions, and bounded recursive loading. The local transaction adapter separates logical component revisions from physical files so rename and reparent move whole descendant subtrees atomically. Relationship bullets keep stable target IDs directly, avoiding duplicated target-name state and rename fan-out. Validation passed with bun run check: 435 tests, build, binary smoke, and Iteration 1A compiled-binary crash recovery.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Stored canonical components as deterministic, prose-first named Markdown documents whose folders mirror the parent hierarchy while stable identity remains embedded in content. Rename and reparent now move affected subtrees atomically, portable sibling collisions fail closed, and shared operations survive restart. Verified with bun run check: 435 tests passed, build and binary smoke passed, and Iteration 1A crash recovery passed.
<!-- SECTION:FINAL_SUMMARY:END -->
