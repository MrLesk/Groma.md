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

Serves the page and the browser bundle, composes the sheet once per world generation, and pushes every new world to the open pages over server-sent events, so the map follows Markdown edits and watched source folds without a reload.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [World loader](../../core/components/world-loader.md) | Loads the architecture world | loadArchitectureViewModel |
| [Sheet](../../core/components/sheet.md) | Composes the sheet once per generation | sheetScene |
| [Page](page.md) | Serves the shell with the world and sheet embedded | renderPage |
| [Architecture watch](../../core/components/architecture-watch.md) | Reloads the world when Markdown changes | watchArchitecture |
| [Scan](../../scanner/components/scan.md) | Folds watched source changes | watchScan |
