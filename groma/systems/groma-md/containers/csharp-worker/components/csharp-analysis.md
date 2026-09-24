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
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/ProjectFile.cs
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/ProjectGraph.cs
description: Loads C# projects into Roslyn and collects declarations and operations
---

Builds one project graph from the repository's solutions and projects, reading the settings each project declares in its file, the nearest Directory.Build.props and the files they import. Loads each C# project once into Roslyn with its transitive references, and collects source declarations, partial-type source units and operation evidence.
