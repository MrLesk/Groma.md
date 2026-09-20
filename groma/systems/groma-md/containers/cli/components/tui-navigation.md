---
type: C4 Component
title: Terminal navigation
status: stable
groma:
  id: tui-navigation
  parent: cli
  code:
    - scanner: typescript
      file: src/viewers/tui/navigation.ts
    - scanner: typescript
      file: src/viewers/tui/navigation-details.ts
    - scanner: typescript
      file: src/viewers/tui/navigation-history.ts
    - scanner: typescript
      file: src/viewers/tui/navigation-search.ts
    - scanner: typescript
      file: src/viewers/tui/navigation-spatial.ts
    - scanner: typescript
      file: src/viewers/tui/navigation-tree.ts
      symbol: reduceTree
    - scanner: typescript
      file: src/viewers/tui/tree.ts
    - scanner: typescript
      file: src/viewers/tui/keys.ts
  group: Terminal map
description: Handles keyboard and pointer selection in the terminal map
---

Handles keyboard and pointer selection. Keeps the current map location, tree, search, details, and revision state.
