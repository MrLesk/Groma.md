---
type: C4 Component
title: C# compiler analysis
status: stable
groma:
  id: dotnet-scanner
  parent: groma-csharpscanner-groma-csharpscanner
  code:
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/Scanner.cs
      symbol: RoslynScanner
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/ProjectInput.cs
      symbol: ProjectInput
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/OperationEvidence.cs
---

Loads the selected project with MSBuild and Roslyn. Collects source declarations and operation evidence from the compilation.
