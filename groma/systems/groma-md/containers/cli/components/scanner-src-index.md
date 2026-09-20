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
    - scanner: typescript
      file: packages/scanner/src/http.ts
    - scanner: typescript
      file: packages/scanner/src/values.ts
  group: Scanner support
description: Defines the data contract every scanner plugin must satisfy
---

Defines source, operation, and discovery data for scanner plugins. Checks these data at the plugin boundary.
