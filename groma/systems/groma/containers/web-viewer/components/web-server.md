---
type: C4 Component
title: Web server
status: stable
groma:
  id: web-server
  parent: web-viewer
  group: Web runtime
  code:
    - scanner: typescript
      file: src/viewers/web/server.ts
      symbol: startWebViewer
      dependencies: 11
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/payload.ts
      dependencies: 8
      dependents: 9
    - scanner: typescript
      file: src/viewers/web/runtime.ts
      dependencies: 4
      dependents: 2
---

Serves the page and browser bundle from cached project, architecture, sheet and task snapshots. It dispatches architecture writes through the shared authoring operations, handles project edits and on-demand source, diff and revision reads, and publishes the resulting live updates.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture watch](../../view-host/components/architecture-watch.md) | Reloads the world when Markdown changes | watchArchitecture |
| [Backlog plugin](../../view-host/components/backlog-plugin.md) | Loads optional work snapshots independently | WorkSource |
| [Page](page.md) | Serves the browser shell and embedded state | HTML |
| [Project profile](../../core/components/project-profile.md) | Loads and saves the project profile | ProjectProfile |
| [Scan lifecycle](../../scanner/components/scan-lifecycle.md) | Folds watched source changes | watchScan |
| [Sheet composition](../../core/components/sheet-composition.md) | Composes the shared map sheet once per generation | In-process data |
| [World loader](../../core/components/world-loader.md) | Loads the semantic architecture graph | In-process data |
| [Work projection](../../view-host/components/work-projection.md) | Maps tasks to architecture anchors | In-process data |
