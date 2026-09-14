---
type: C4 Component
title: Angular analysis
status: stable
groma:
  id: angular-src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/angular/src/index.ts
    - scanner: typescript
      file: plugins/scanners/angular/src/scan.ts
  group: Language analysis
---

Checks Angular projects with the Angular compiler. Returns source and template callback evidence.
