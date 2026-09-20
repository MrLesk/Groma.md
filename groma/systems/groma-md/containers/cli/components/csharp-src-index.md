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
  group: Language analysis
description: Starts the C# worker and converts its result into scan evidence
---

Selects declared C# projects and starts the bundled .NET worker. Converts its source analysis and outlines into the shared scanner contract.
