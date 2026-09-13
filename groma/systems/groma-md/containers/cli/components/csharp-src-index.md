---
type: C4 Component
title: C# scanner adapter
status: stable
groma:
  id: csharp-src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/csharp/src/index.ts
    - scanner: typescript
      file: plugins/scanners/csharp/src/config.ts
    - scanner: typescript
      file: plugins/scanners/csharp/src/adapter.ts
    - scanner: typescript
      file: plugins/scanners/csharp/src/process.ts
  group: Scanner plugins
---

Selects C# projects and checks the .NET tools. Starts the C# worker and reads its scan result.
