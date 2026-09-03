---
type: C4 Component
title: Navigation
status: stable
groma:
  id: navigation
  parent: terminal-viewer
  group: Navigation
  code:
    - scanner: typescript
      file: src/viewers/tui/navigation.ts
      dependencies: 15
      dependents: 13
    - scanner: typescript
      file: src/viewers/tui/navigation-spatial.ts
      dependencies: 6
      dependents: 2
---

Reduces every terminal key over one viewer state and moves selection by the nearest visible peer, including container scope and temporary Work focus.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Navigation history](navigation-history.md) | Delegates revision-list state | TypeScript |
