---
id: csharp-scanner
kind: component
parent: scanner
group: Language scanners
code:
  - scanner: typescript
    file: src/scanner/csharp/adapter.ts
    symbol: scanCSharpSource
    dependencies: 1
    dependents: 1
  - scanner: csharp
    file: src/scanner/csharp/Contract.cs
    symbol: ScanObservation
  - scanner: csharp
    file: src/scanner/csharp/Scanner.cs
    symbol: RoslynScanner
  - scanner: csharp
    file: src/scanner/csharp/Command.cs
    symbol: ScannerCommand
  - scanner: csharp
    file: src/scanner/csharp/Program.cs
---

# C# scanner

Uses Roslyn project semantics to report every C# file and declared type separately. Project membership supplies placement, project references connect scopes, and resolved source symbols produce deterministic file-to-file source-dependency evidence. Partial types remain separate file evidence.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Scanner observation](scanner-observation.md) | Publishes one complete observation | JSON |
