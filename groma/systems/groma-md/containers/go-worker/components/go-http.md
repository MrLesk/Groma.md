---
type: C4 Component
title: Go HTTP analysis
status: stable
groma:
  id: go-http
  parent: go-worker
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
description: Finds Go HTTP clients, routers and endpoints
---

Recognizes supported Go HTTP clients, router mounts and endpoints. Returns request and provider evidence from the parsed source.
