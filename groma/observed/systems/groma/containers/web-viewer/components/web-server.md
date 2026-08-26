---
id: web-server
kind: component
parent: web-viewer
group: Web runtime
code:
  - scanner: typescript
    file: src/viewers/web/server.ts
    symbol: startWebViewer
    dependencies: 9
    dependents: 1
  - scanner: typescript
    file: src/viewers/web/payload.ts
    dependencies: 4
    dependents: 3
---

# Web server

Serves the page and browser bundle from the latest cached map. It loads the optional project profile and semantic architecture without ELK; a missing or invalid profile is published as `null` so the browser omits its title plate. Valid profile edits go to core, then update only the cached profile before publishing. Architecture Markdown changes arrive through the architecture watcher. Backlog loads asynchronously and publishes separate work-overlay events that never place or route the map.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [World loader](../../core/components/world-loader.md) | Loads the semantic architecture graph | loadAnnotatedArchitecture |
| [Project profile](../../core/components/project-profile.md) | Loads and saves the project name and description | ProjectProfile |
| [Sheet](../../core/components/sheet.md) | Composes the sheet once per generation | sheetScene |
| [Page](page.md) | Serves the shell with the project, world and sheet embedded | renderPage |
| [Backlog plugin](../../view-host/components/backlog-plugin.md) | Supplies optional work-overlay snapshots without delaying or recalculating the map | WorkSource |
| [Architecture watch](../../core/components/architecture-watch.md) | Reloads the world when Markdown changes | watchArchitecture |
| [Scan](../../scanner/components/scan.md) | Folds watched source changes | watchScan |
