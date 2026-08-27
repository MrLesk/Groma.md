---
id: source-viewer
kind: component
parent: web-viewer
group: Web chrome
code:
  - scanner: typescript
    file: src/viewers/web/source/control.ts
    symbol: createSourceControl
    dependencies: 3
    dependents: 1
  - scanner: typescript
    file: src/viewers/web/source/read.ts
    symbol: readSource
    dependencies: 3
    dependents: 3
  - scanner: typescript
    file: src/viewers/web/source/view.ts
    symbol: paintSource
    dependencies: 2
    dependents: 2
---

# Source viewer

Opens one exact Code file from the selected component inside the details pane, reads it on demand from the architecture's active working tree or full Git revision, and paints line-numbered source with the current theme's syntax palette. Back removes only this file drill-down and keeps the component selected.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Web server](web-server.md) | Requests only the selected component file from the active revision | HTTP |
| [Details](web-viewer-details.md) | Reuses the selected component's inspector surface | DOM |
