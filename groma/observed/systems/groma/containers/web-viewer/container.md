---
id: web-viewer
kind: container
parent: groma
technology: SVG, Bun serve
code:
  - scanner: typescript
    file: src/viewers/web/server.ts
    symbol: startWebViewer
---

# Web viewer

Shows the architecture in a browser as an isometric blueprint: the sheet core composed, painted as SVG with every name lying on its roof, zoomed and panned by the person, with one selection shared with the hierarchy and details panes. `groma web` starts it and pushes every new world to the open page.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Core](../core/container.md) | Loads the architecture world | loadArchitectureViewModel |
| [Sheet](../core/components/sheet.md) | Composes the sheet once per generation | sheetScene |
| [Architecture watch](../core/components/architecture-watch.md) | Reloads the world when Markdown changes | watchArchitecture |
| [Scanner](../scanner/container.md) | Folds watched source changes | watchScan |
