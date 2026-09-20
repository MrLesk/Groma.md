---
type: C4 Component
title: Duplicate review data
status: stable
groma:
  id: src-architecture-findings
  parent: cli
  code:
    - scanner: typescript
      file: src/architecture-findings.ts
  group: Source scanning
description: Compares operation bodies and reports possible duplicated logic
---

Compares source operations and reports possible copies. Keeps these findings separate from architecture relationships.
