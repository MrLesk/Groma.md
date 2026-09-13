---
type: C4 Component
title: Go compiler analysis
status: stable
groma:
  id: worker-main
  parent: groma-local-scanner-go-groma-local-scanner-go
  code:
    - scanner: go
      file: plugins/scanners/go/worker/main.go
    - scanner: go
      file: plugins/scanners/go/worker/contract.go
    - scanner: go
      file: plugins/scanners/go/worker/evidence.go
---

Loads the active Go module with the Go compiler tools. Writes source declarations and operation evidence as a scanner result.
