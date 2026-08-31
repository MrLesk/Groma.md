---
type: C4 Component
title: Scan observation
status: stable
groma:
  id: scan-observation
  parent: scanner
  group: Scan lifecycle
  code:
    - scanner: typescript
      file: src/scanner/observation.ts
      dependencies: 0
      dependents: 4
---

Defines and validates the complete language-neutral observation contract for source files, scopes, placements, source dependencies, and diagnostics.
