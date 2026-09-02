---
type: C4 Component
title: Source viewer
status: stable
groma:
  id: source-viewer
  parent: web-viewer
  code:
    - scanner: typescript
      file: src/viewers/web/source/control.ts
      dependencies: 4
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/source/read.ts
      dependencies: 3
      dependents: 6
    - scanner: typescript
      file: src/viewers/web/source/structure.ts
      dependencies: 3
      dependents: 6
    - scanner: typescript
      file: src/viewers/web/source/view.ts
      dependencies: 4
      dependents: 2
    - scanner: typescript
      file: src/viewers/web/source/highlight.ts
      dependencies: 0
      dependents: 3
---

Reads a selected component named TypeScript structure on demand from the active working tree or full Git revision. Files preserve authored order; top-level callables include exports and module-private helpers, while classes group public, protected, and private methods. Every declaration opens the exact source line inside Details without changing the component selection.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Web server](web-server.md) | Requests only selected Code from the active revision | HTTP |
| [Web viewer details](web-viewer-details.md) | Reuses the selected component inspector | DOM |
