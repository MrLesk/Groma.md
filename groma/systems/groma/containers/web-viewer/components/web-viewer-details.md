---
type: C4 Component
title: Web viewer details
status: stable
groma:
  id: web-viewer-details
  parent: web-viewer
  group: Web chrome
  code:
    - scanner: typescript
      file: src/viewers/web/organisms/details.ts
    - scanner: typescript
      file: src/viewers/web/organisms/relationship-details.ts
      symbol: paintRelationship
---

Inspects the current architecture or task selection and paints its meaning, relationships, command flows, and build evidence. How it's built shows technology and Code; a warning nests copies under matching operations.
