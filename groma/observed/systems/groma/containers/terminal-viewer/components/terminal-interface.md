---
id: terminal-interface
kind: component
parent: terminal-viewer
code:
  - scanner: typescript
    file: src/viewers/tui/terminal-viewer.ts
    symbol: startTerminalViewer
---

# Terminal interface

Projects the fixed world in a terminal. It never reads architecture Markdown.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [World layout](../../core/components/world-layout.md) | Draws fixed positions and directed routes | In-process data |
