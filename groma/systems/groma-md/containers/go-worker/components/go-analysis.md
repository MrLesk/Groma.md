---
type: C4 Component
title: Go compiler analysis
status: stable
groma:
  id: go-analysis
  parent: go-worker
  code:
    - scanner: go
      file: plugins/scanners/go/worker/main.go
    - scanner: go
      file: plugins/scanners/go/worker/contract.go
    - scanner: go
      file: plugins/scanners/go/worker/evidence.go
    - scanner: go
      file: plugins/scanners/go/worker/project.go
    - scanner: go
      file: plugins/scanners/go/worker/tokens.go
description: Type-checks Go module source and returns declarations and operations
---

Loads active Go module source with the bundled parser and type checker. Returns declarations and operation evidence for the scanner result.
