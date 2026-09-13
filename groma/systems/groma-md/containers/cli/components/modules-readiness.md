---
type: C4 Component
title: Scanner readiness
status: stable
groma:
  id: modules-readiness
  parent: cli
  code:
    - scanner: typescript
      file: src/scanner/modules/readiness.ts
  group: Plugin management
---

Runs the preparation checks supplied by each selected scanner. Reports missing tools or packages before a scan.
