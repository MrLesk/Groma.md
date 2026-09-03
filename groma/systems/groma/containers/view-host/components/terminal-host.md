---
type: C4 Component
title: Terminal host
status: stable
groma:
  id: terminal-host
  parent: view-host
  code:
    - scanner: typescript
      file: src/view-host.ts
      symbol: startTerminalViewer
      dependencies: 11
      dependents: 1
---

Starts the terminal map, publishes live architecture and work snapshots, and loads selected read-only revisions until Current resumes.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture watch](architecture-watch.md) | Reloads the world when Markdown changes | watchArchitecture |
| [Backlog plugin](backlog-plugin.md) | Reads workflow and task snapshots | WorkSnapshot |
| [Scan lifecycle](../../scanner/components/scan-lifecycle.md) | Folds watched source changes | watchScan |
| [Screen](../../terminal-viewer/components/screen.md) | Publishes the composed terminal view | OpenTUI |
| [World loader](../../core/components/world-loader.md) | Loads the semantic architecture graph | In-process data |
| [Revisions](revisions.md) | Loads current and historical terminal models | TypeScript |
