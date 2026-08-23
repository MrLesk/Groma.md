---
id: web-server
kind: component
parent: web-viewer
code:
  - scanner: typescript
    file: src/viewers/web/server.ts
    symbol: startWebViewer
---

# Web server

Serves the page and browser bundle from the latest cached map. It composes a sheet only when architecture changes, while Backlog loads asynchronously and publishes separate work-overlay events that never place or route the map.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [World loader](../../core/components/world-loader.md) | Loads the architecture world | loadArchitectureViewModel |
| [Sheet](../../core/components/sheet.md) | Composes the sheet once per generation | sheetScene |
| [Page](page.md) | Serves the shell with the world and sheet embedded | renderPage |
| [Backlog plugin](../../view-host/components/backlog-plugin.md) | Supplies optional work-overlay snapshots without delaying or recalculating the map | WorkSource |
| [Architecture watch](../../core/components/architecture-watch.md) | Reloads the world when Markdown changes | watchArchitecture |
| [Scan](../../scanner/components/scan.md) | Folds watched source changes | watchScan |
