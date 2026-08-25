---
id: csharp-scanner
kind: component
parent: scanner
code:
  - scanner: typescript
    file: src/scanner/csharp/adapter.ts
    symbol: isCSharpScanFile
---

# C# scanner

Uses Roslyn project semantics to report every C# file and declared type separately. Project membership supplies placement and project references supply source relationships; partial types remain separate file evidence.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Scanner observation](scanner-observation.md) | Publishes one complete observation | JSON |
