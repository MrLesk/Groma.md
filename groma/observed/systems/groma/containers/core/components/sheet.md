---
id: sheet
kind: component
parent: core
group: World building
code:
  - scanner: typescript
    file: src/sheet/scene.ts
    symbol: sheetScene
---

# Sheet

Composes the viewers' shared blueprint sheet from the semantic architecture graph: flat architecture surfaces, group zones, one lattice route per authored relationship, and one component building section per unique code file. Each observed file contributes one to four floors from its project-relative LOC; two or three files step inward, while four or more keep one footprint as a vertical tower. Semantic identity orders siblings, and coordinates from another layout are never consulted.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Sheet router](sheet-router.md) | Routes every relationship on the quarter-cell lattice | In-process data |
