---
type: C4 Component
title: C# worker command
status: stable
groma:
  id: csharp-command
  parent: csharp-worker
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
description: Reads a C# scan request and writes the worker result
---

Reads a scan or outline request as JSON on standard input and checks the repository paths it names. Writes the result in the scanner data format.
