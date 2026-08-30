---
id: source-viewer
kind: component
parent: web-viewer
group: Web chrome
code:
  - scanner: typescript
    file: src/viewers/web/source/control.ts
    symbol: createSourceControl
    dependencies: 4
    dependents: 1
  - scanner: typescript
    file: src/viewers/web/source/read.ts
    symbol: readSource
    dependencies: 3
    dependents: 3
  - scanner: typescript
    file: src/viewers/web/source/structure.ts
    symbol: readCodeStructure
    dependencies: 3
    dependents: 3
  - scanner: typescript
    file: src/viewers/web/source/view.ts
    symbol: paintSource
    dependencies: 4
    dependents: 2
---

# Source viewer

Reads a selected component's named TypeScript structure on demand from the architecture's active working tree or full Git revision. Files preserve authored order; top-level callables include exports and module-private helpers, while classes group their public, protected and private methods. It opens an exact component file, optionally at a declaration line, inside the details pane and paints line-numbered source with the current theme's syntax palette. Back removes only this source drill-down and keeps the component selected.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Web server](web-server.md) | Requests only the selected component file from the active revision | HTTP |
| [Details](web-viewer-details.md) | Reuses the selected component's inspector surface | DOM |
