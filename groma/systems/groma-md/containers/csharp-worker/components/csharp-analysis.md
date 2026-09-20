---
type: C4 Component
title: C# compiler analysis
status: stable
groma:
  id: csharp-analysis
  parent: csharp-worker
  code:
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/Scanner.cs
      symbol: RoslynScanner
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/ProjectInput.cs
      symbol: ProjectInput
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/OperationEvidence.cs
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/OperationId.cs
      symbol: OperationId
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/OperationTokens.cs
      symbol: OperationTokens
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/PartialSourceUnits.cs
      symbol: PartialSourceUnits
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/SourceProject.cs
      symbol: SourceProject
description: Loads C# projects into Roslyn and collects declarations and operations
---

Loads declared C# source projects into Roslyn. Collects source declarations, partial-type source units and operation evidence from the compilation.
