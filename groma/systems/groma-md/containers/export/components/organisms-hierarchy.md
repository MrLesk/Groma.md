---
type: C4 Component
title: Architecture tree
status: stable
groma:
  id: organisms-hierarchy
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/organisms/hierarchy.ts
      symbol: paintHierarchy
    - scanner: typescript
      file: src/viewers/web/organisms/sidebar-row.ts
  group: Architecture panels
description: Shows the architecture tree and follows the current selection
---

Shows systems, containers, groups, and components in a tree. Updates the open branches when the selection changes.
