---
type: C4 Component
title: Source interactions
status: stable
groma:
  id: scan-evidence
  parent: cli
  code:
    - scanner: typescript
      file: src/scan-evidence.ts
    - scanner: typescript
      file: src/relationship-inference.ts
  group: Source scanning
---

Combines operation evidence from scanners. Derives a relationship only when the supplied callback has one known provider.
