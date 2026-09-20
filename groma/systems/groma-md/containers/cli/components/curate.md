---
type: C4 Component
title: Architecture structure
status: stable
groma:
  id: curate
  parent: cli
  code:
    - scanner: typescript
      file: src/curate.ts
    - scanner: typescript
      file: src/group.ts
    - scanner: typescript
      file: src/curate-rename.ts
    - scanner: typescript
      file: src/curate-rewrites.ts
    - scanner: typescript
      file: src/movable.ts
      symbol: moveBlocker
  group: Architecture records
description: Moves, combines and groups elements without changing their meaning
---

Moves, combines and renames architecture elements while preserving source ownership and links. Assigns named groups within containers and checks that structural changes preserve authored meaning.
