---
type: C4 Component
title: Go HTTP analysis
status: stable
groma:
  id: worker-http
  parent: groma-local-scanner-go-groma-local-scanner-go
  code:
    - scanner: go
      file: plugins/scanners/go/worker/http.go
    - scanner: go
      file: plugins/scanners/go/worker/mounts.go
    - scanner: go
      file: plugins/scanners/go/worker/requests.go
    - scanner: go
      file: plugins/scanners/go/worker/routes.go
    - scanner: go
      file: plugins/scanners/go/worker/values.go
---

Recognizes supported Go HTTP clients, router mounts and endpoints. Returns request and provider evidence from the parsed source.
