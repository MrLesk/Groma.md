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
      file: packages/scanner/src/index.ts
---

Publishes the scanner-module interface and validates complete language-neutral observations for source files, scopes, placements, source dependencies, and diagnostics.
