---
type: C4 Component
title: Scanner modules
status: stable
groma:
  id: scanner-modules
  parent: scanner
  group: Scanner modules
  code:
    - scanner: typescript
      file: src/scanner/modules/config.ts
    - scanner: typescript
      file: src/scanner/modules/package.ts
    - scanner: typescript
      file: src/scanner/modules/inventory.ts
    - scanner: typescript
      file: src/scanner/cli.ts
      symbol: registerScannerCommands
---

Manages explicit project scanner configuration, validates package manifests,
installs exact npm sources into Groma's shared cache, and derives readiness
without executing scanner code.
