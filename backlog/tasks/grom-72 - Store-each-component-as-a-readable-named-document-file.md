---
id: GROM-72
title: Store each component as a readable named document file
status: To Do
assignee: []
created_date: '2026-07-20 17:44'
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
- [ ] #1 A component persists as one Markdown file named from its name inside folders mirroring its parent chain, and rename or reparent moves the file in the same transaction
- [ ] #2 Identity always comes from the stable id in the file; a hand-moved or hand-renamed file never changes identity
- [ ] #3 Frontmatter is minimal and prose-first: intent, items, and relationships render as readable Markdown with stable short ids in HTML comments
- [ ] #4 Serialization is deterministic and byte-stable; sibling filename collisions fail closed with an actionable diagnostic
- [ ] #5 Every existing operation keeps working through shared application operations and bun run check stays green
<!-- AC:END -->
