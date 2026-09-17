---
type: C4 Component
title: Catalog
status: stable
groma:
  id: catalog
  parent: service
  code:
    - scanner: go
      file: store.go
      symbol: NewStore
    - scanner: typescript
      file: web/app.ts
    - scanner: go
      file: remote.go
---

Stores catalog entries and renders them.
