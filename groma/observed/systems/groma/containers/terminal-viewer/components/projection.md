---
id: projection
kind: component
parent: terminal-viewer
group: Projection
code:
  - scanner: typescript
    file: src/viewers/tui/projection.ts
    symbol: projectWorld
---

# Projection

Projects the laid-out world into the map pane: camera, C4 level, cards, boundaries, and routes, rastered into cells.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Semantic view](../../core/components/semantic-view.md) | Asks for the semantic city of the current level | In-process data |
| [World layout](../../core/components/world-layout.md) | Uses fixed positions and routes | In-process data |
