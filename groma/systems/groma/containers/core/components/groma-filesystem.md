---
type: C4 Component
title: Groma filesystem
status: stable
groma:
  id: groma-filesystem
  parent: core
  group: Architecture storage
  code:
    - scanner: typescript
      file: src/groma-filesystem.ts
      dependencies: 0
      dependents: 13
---

Resolves exactly one project-owned groma/ or .groma/ root and owns architecture file reads, writes, listings, removals, existence checks, and watches so callers use paths relative to the selected root.
