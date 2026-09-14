---
type: C4 Component
title: Python scanner package
status: stable
groma:
  id: build
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/python/build.ts
      symbol: buildPackage
  group: Scanner development
---

Builds the Python scanner package. Includes the scanner adapter, Python worker, and license file.
