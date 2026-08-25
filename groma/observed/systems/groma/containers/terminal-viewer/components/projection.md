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

Projects the shared sheet scene into terminal cells at a fixed scale. The root scope shows actors, systems, containers, collapsed groups, and external systems. A container scope replaces that map with the container's groups and direct components. Both scopes keep sheet positions and routes immutable.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Sheet](../../core/components/sheet.md) | Uses its fixed surfaces, buildings, zones, and routes | In-process data |
