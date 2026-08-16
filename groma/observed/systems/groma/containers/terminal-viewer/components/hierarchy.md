---
id: hierarchy
kind: component
parent: terminal-viewer
code:
  - scanner: typescript
    file: src/viewers/tui/organisms/hierarchy.ts
    symbol: drawHierarchy
---

# Hierarchy

Lists the merged world as a containment tree and shares one selection with the map.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Map](map.md) | Selects an element and frames it | In-process data |
