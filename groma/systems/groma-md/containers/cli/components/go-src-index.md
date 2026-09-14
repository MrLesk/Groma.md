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
---

Selects Go modules and checks the Go tools. Starts the Go worker and reads its scan result.
