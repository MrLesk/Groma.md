---
type: C4 Component
title: C# worker command
status: stable
groma:
  id: program
  parent: groma-csharpscanner-groma-csharpscanner
  code:
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/Program.cs
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/Command.cs
      symbol: ScannerCommand
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/ScanRequest.cs
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/Contract.cs
---

Reads the scan request and checks its project paths. Writes the worker result in the scanner data format.
