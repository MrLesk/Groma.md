---
type: C4 Component
title: Architecture reader
status: stable
groma:
  id: architecture-reader
  parent: core
  group: Architecture world
  code:
    - scanner: typescript
      file: src/architecture-reader.ts
      dependencies: 3
      dependents: 9
---

Requires the root OKF v0.2 declaration and explicit Groma project profile,
then reads reserved context and typed concepts into deterministic revision
records. It is the only owner that walks the package, and it admits only the
four exact C4 types to the architecture model.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Groma filesystem](groma-filesystem.md) | Reads the selected architecture tree | Filesystem access |
