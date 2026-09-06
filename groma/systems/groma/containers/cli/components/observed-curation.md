---
type: C4 Component
title: Observed curation
status: stable
groma:
  id: observed-curation
  parent: cli
  group: Architecture authoring
  code:
    - scanner: typescript
      file: src/curate.ts
    - scanner: typescript
      file: src/group.ts
    - scanner: typescript
      file: src/relation.ts
    - scanner: typescript
      file: src/move.ts
      symbol: moveBlocker
---

Curates architecture through shared validated operations: group sibling components, move empty scan evidence, combine empty records, and create, edit or explicitly accept directed relationships. Only draft relationships without flow references can be removed; current relationships are protected. Planned relationships keep their own draft lifecycle independently of endpoint status. Changes validate before writing and preserve authored meaning; structural replacements that would discard meaning are refused.
