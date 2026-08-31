---
type: C4 Component
title: Scanner modules
status: stable
groma:
  id: scanner-modules
  parent: scanner
  group: Scanner modules
  code:
    - scanner: typescript
      file: src/scanner/modules/config.ts
      dependencies: 0
      dependents: 1
    - scanner: typescript
      file: src/scanner/modules/package.ts
      dependencies: 0
      dependents: 2
    - scanner: typescript
      file: src/scanner/modules/inventory.ts
      dependencies: 2
      dependents: 2
    - scanner: typescript
      file: src/scanner/cli.ts
      dependencies: 1
      dependents: 1
---

Manages explicit project scanner configuration, validates package manifests,
installs exact npm sources into Groma's shared cache, and derives readiness
without executing scanner code.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Scan lifecycle](scan-lifecycle.md) | Supplies enabled and verified module entries | ECMAScript module path |
