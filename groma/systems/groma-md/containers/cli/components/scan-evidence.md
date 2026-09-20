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
    - scanner: typescript
      file: src/http-relationships.ts
      symbol: httpRelationships
  group: Source scanning
---

Combines operation and HTTP evidence from scanners. Derives architecture relationships only when callback or request evidence identifies a supported provider.
