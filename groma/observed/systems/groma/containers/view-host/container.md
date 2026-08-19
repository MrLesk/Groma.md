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

Composes an architecture snapshot and optional Backlog work, then gives the
terminal viewer a complete view model.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Core](../core/container.md) | Loads the architecture world | loadArchitectureViewModel |
| [Backlog plugin](components/backlog-plugin.md) | Reads in-progress tasks as plain work | createBacklogPlugin |
| [Terminal viewer](../terminal-viewer/container.md) | Paints the composed view model | mountTerminalViewer |

