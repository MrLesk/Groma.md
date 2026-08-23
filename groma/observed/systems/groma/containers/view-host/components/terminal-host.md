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

Starts the terminal map and keeps it current: loads the world, folds in in-progress Backlog work when the CLI answers, and publishes a fresh view model after every watched source fold or Markdown change.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [World loader](../../core/components/world-loader.md) | Loads the architecture world | loadArchitectureViewModel |
| [Backlog plugin](backlog-plugin.md) | Reads the configured Backlog workflow and available tasks | createBacklogPlugin |
| [Work projection](work-projection.md) | Marks the elements tasks reference | projectActiveWork |
| [Architecture watch](../../core/components/architecture-watch.md) | Reloads the world when Markdown changes | watchArchitecture |
| [Scan](../../scanner/components/scan.md) | Folds watched source changes | watchScan |
| [Screen](../../terminal-viewer/components/screen.md) | Paints the composed view model | mountTerminalViewer |
