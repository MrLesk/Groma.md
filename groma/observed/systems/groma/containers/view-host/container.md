---
id: view-host
kind: container
parent: groma
code:
  - scanner: typescript
    file: src/view-host.ts
    symbol: startTerminalViewer
---

# View host

Composes what the terminal viewer shows: the architecture world from core, in-progress Backlog work when the CLI answers, and a fresh world after every watched source fold or Markdown change. A missing or slow Backlog never blocks the map.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Core](../core/container.md) | Loads the architecture world | loadArchitectureViewModel |
| [Backlog plugin](components/backlog-plugin.md) | Reads in-progress tasks as plain work | createBacklogPlugin |
| [Work projection](components/work-projection.md) | Marks the elements tasks reference | projectActiveWork |
| [Architecture watch](../core/components/architecture-watch.md) | Reloads the world when Markdown changes | watchArchitecture |
| [Scanner](../scanner/container.md) | Folds watched source changes | watchScan |
| [Terminal viewer](../terminal-viewer/container.md) | Paints the composed view model | mountTerminalViewer |
