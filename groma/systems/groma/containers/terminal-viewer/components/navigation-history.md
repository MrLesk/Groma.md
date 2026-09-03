---
type: C4 Component
title: Navigation history
status: stable
groma:
  id: navigation-history
  parent: terminal-viewer
  code:
    - scanner: typescript
      file: src/viewers/tui/navigation-history.ts
      dependencies: 2
      dependents: 2
  group: Navigation
---

Owns the terminal revision-list cursor, compatible selection, and return to Current.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Revisions](../../view-host/components/revisions.md) | Selects compatible Groma revisions | TypeScript |
