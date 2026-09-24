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
    - scanner: go
      file: plugins/scanners/go/worker/libraries.go
    - scanner: go
      file: plugins/scanners/go/worker/routers.go
    - scanner: go
      file: plugins/scanners/go/worker/library_nethttp.go
    - scanner: go
      file: plugins/scanners/go/worker/library_chi.go
    - scanner: go
      file: plugins/scanners/go/worker/library_gin.go
      symbol: gin
    - scanner: go
      file: plugins/scanners/go/worker/library_echo.go
      symbol: echo
    - scanner: go
      file: plugins/scanners/go/worker/library_httprouter.go
      symbol: httprouter
    - scanner: go
      file: plugins/scanners/go/worker/library_prometheus.go
      symbol: prometheusRoute
    - scanner: go
      file: plugins/scanners/go/worker/library_gorilla.go
    - scanner: go
      file: plugins/scanners/go/worker/endpoints.go
description: Finds Go HTTP clients, routers and endpoints
---

Recognizes supported Go HTTP clients, router mounts and endpoints. Each router library is one record in its own file, which the route readers consult for every library-specific rule, so a new library is a new record. Returns request and provider evidence from the parsed source.
