---
id: c-scanner
kind: component
parent: scanner
group: "Language scanners"
code:
  - scanner: typescript
    file: src/scanner/csharp/adapter.ts
    dependencies: 1
    dependents: 1
---

# C# scanner

Starts the Roslyn scanner adapter for a repository solution or project and returns its complete C# observation through the shared contract.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Scan observation](scan-observation.md) | Publishes one complete observation | JSON |
