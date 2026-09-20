---
type: C4 Component
title: Scanner execution
status: stable
groma:
  id: scanner-registry
  parent: cli
  code:
    - scanner: typescript
      file: src/scanner/registry.ts
  group: Source scanning
description: Loads selected scanner plugins and collects their results
---

Loads selected scanner plugins and collects their results. Keeps successful results when another scanner fails.
