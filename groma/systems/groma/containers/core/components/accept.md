---
type: C4 Component
title: Accept
status: stable
groma:
  id: accept
  parent: core
  group: Architecture changes
  code:
    - scanner: typescript
      file: src/accept.ts
---

Flips a scan-matched ghost to stable in its own file, keeping its identity, its authored OKF document, its Code evidence, and its draft tag.
