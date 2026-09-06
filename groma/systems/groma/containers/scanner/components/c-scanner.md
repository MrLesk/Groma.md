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
    - scanner: typescript
      file: plugins/scanners/csharp/src/adapter.ts
---

Exports the optional C# scanner module. When a project enables it, the module
starts its Roslyn adapter for a repository solution or project and returns one
complete observation through the shared contract.
