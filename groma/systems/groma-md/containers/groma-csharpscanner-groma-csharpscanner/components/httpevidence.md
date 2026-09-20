---
type: C4 Component
title: C# HTTP analysis
status: stable
groma:
  id: httpevidence
  parent: groma-csharpscanner-groma-csharpscanner
  code:
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/HttpEvidence.cs
      symbol: HttpEvidence
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/HttpEndpoints.cs
      symbol: HttpEndpoints
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/HttpRequests.cs
      symbol: HttpRequests
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/HttpRoutes.cs
    - scanner: csharp
      file: plugins/scanners/csharp/dotnet/HttpSyntax.cs
      symbol: HttpSyntax
---

Recognizes supported C# HTTP clients, route registrations and endpoints. Resolves their source values and returns request and provider evidence with the compiler scan.
