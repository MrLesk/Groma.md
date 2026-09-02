---
type: C4 Component
title: C# scanner
status: stable
groma:
  id: c-scanner
  parent: scanner
  group: Language scanners
  code:
    - scanner: typescript
      file: plugins/scanners/csharp/src/index.ts
      dependencies: 1
      dependents: 0
    - scanner: typescript
      file: plugins/scanners/csharp/src/adapter.ts
      dependencies: 0
      dependents: 1
---

Exports the optional C# scanner module. When a project enables it, the module
starts its Roslyn adapter for a repository solution or project and returns one
complete observation through the shared contract.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Scan observation](scan-observation.md) | Publishes one complete observation | JSON |
