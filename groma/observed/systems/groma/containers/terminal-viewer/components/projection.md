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

Projects the laid-out world into terminal cells at a fixed scale. The root scope shows actors, systems, containers, collapsed groups, and external systems. A container scope replaces that map with the container's groups and direct components. Both scopes keep the existing world positions and routes.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Semantic view](../../core/components/semantic-view.md) | Asks for the visible items and promoted relationships in the current scope | In-process data |
| [World layout](../../core/components/world-layout.md) | Uses fixed positions and routes | In-process data |
