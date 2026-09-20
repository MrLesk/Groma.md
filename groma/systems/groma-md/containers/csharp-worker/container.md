---
type: C4 Container
title: C# worker
status: stable
groma:
  id: csharp-worker
  parent: groma-md
  technology: C#, Roslyn
description: Analyses C# source in a separate .NET process
---

Runs C# source analysis in a separate .NET process using Roslyn. Returns declarations, operations, HTTP evidence and source outlines to the Groma scanner adapter.
