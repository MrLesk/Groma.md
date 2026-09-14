---
type: C4 Component
title: React analysis
status: stable
groma:
  id: react-src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/react/src/index.ts
    - scanner: typescript
      file: plugins/scanners/react/src/scan.ts
  group: Language analysis
---

Reads React source with its compiler. Returns component and JSX callback evidence.
