---
id: projection
kind: component
parent: terminal-viewer
code:
  - scanner: typescript
    file: src/viewers/tui/projection.ts
    symbol: fitView
---

# Projection

Projects the laid-out world into the map pane: camera, C4 level, cards, boundaries, and routes.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [World layout](../../core/components/world-layout.md) | Uses fixed positions and routes | In-process data |
