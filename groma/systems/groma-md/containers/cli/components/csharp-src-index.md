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
      symbol: scanner
    - scanner: typescript
      file: plugins/scanners/csharp/src/config.ts
    - scanner: typescript
      file: plugins/scanners/csharp/src/adapter.ts
    - scanner: typescript
      file: plugins/scanners/csharp/src/process.ts
  group: Language analysis
description: Starts the C# worker and converts its result into scan evidence
---

Sends the repository's tracked C# inventory and inputs to the bundled .NET worker in one request, so each project loads once, and returns the observation and source outlines through the shared scanner contract. Leaves build output, test code and generated files out of the inventory, and lists every other C# file to explain files without an owner.
