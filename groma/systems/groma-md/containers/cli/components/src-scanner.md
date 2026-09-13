---
type: C4 Component
title: Scan results
status: stable
groma:
  id: src-scanner
  parent: cli
  code:
    - scanner: typescript
      file: src/scanner.ts
    - scanner: typescript
      file: src/scan-reconciler.ts
    - scanner: typescript
      file: src/scan-component-naming.ts
  group: Source scanning
---

Updates architecture records from successful scanner results. Preserves authored meaning and the assigned owner of each source file.
