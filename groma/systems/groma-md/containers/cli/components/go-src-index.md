---
type: C4 Component
title: Go scanner adapter
status: stable
groma:
  id: go-src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/go/src/index.ts
    - scanner: typescript
      file: plugins/scanners/go/src/adapter.ts
  group: Language analysis
description: Starts the Go worker and converts its result into scan evidence
---

Selects Go modules and starts the bundled Go worker. Returns its source analysis and outlines through the shared scanner contract.
