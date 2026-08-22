---
id: semantic-view
kind: component
parent: core
group: World building
code:
  - scanner: typescript
    file: src/semantic-view.ts
    symbol: displaySize
---

# Semantic view

Derives the terminal map's semantic city for one C4 level and focus: which elements are named, which are unnamed underlay, which are marks, and which relationships promote to the visible boxes.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Semantic city](semantic-city.md) | Promotes endpoints and synthesizes routes | In-process data |
