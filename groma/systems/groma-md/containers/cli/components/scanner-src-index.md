---
type: C4 Component
title: Scanner contract
status: stable
groma:
  id: scanner-src-index
  parent: cli
  code:
    - scanner: typescript
      file: packages/scanner/src/index.ts
    - scanner: typescript
      file: packages/scanner/src/discovery.ts
  group: Scanner support
---

Defines source, operation, and discovery data for scanner plugins. Checks these data at the plugin boundary.
