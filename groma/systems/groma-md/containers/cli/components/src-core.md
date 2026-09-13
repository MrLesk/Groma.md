---
type: C4 Component
title: Architecture view model
status: stable
groma:
  id: src-core
  parent: cli
  code:
    - scanner: typescript
      file: src/core.ts
    - scanner: typescript
      file: src/plain-world.ts
    - scanner: typescript
      file: src/element-order.ts
      symbol: compareSemanticElements
  group: Architecture records
---

Prepares element details, file sizes, and relationships for the viewers. Supplies the plain text view and shared display order.
