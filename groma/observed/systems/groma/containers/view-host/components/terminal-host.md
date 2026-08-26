---
id: terminal-host
kind: component
parent: view-host
code:
  - scanner: typescript
    file: src/view-host.ts
    symbol: startTerminalViewer
---

# Terminal host

Starts the terminal map and keeps it current: loads the architecture and Backlog workflow independently, then publishes their latest snapshots after watched source, Markdown, or task changes.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [World loader](../../core/components/world-loader.md) | Loads the architecture world | loadArchitectureViewModel |
| [Backlog plugin](backlog-plugin.md) | Reads the configured Backlog workflow and available tasks | createBacklogPlugin |
| [Architecture watch](../../core/components/architecture-watch.md) | Reloads the world when Markdown changes | watchArchitecture |
| [Scan](../../scanner/components/scan.md) | Folds watched source changes | watchScan |
| [Screen](../../terminal-viewer/components/screen.md) | Paints the composed view model | mountTerminalViewer |
