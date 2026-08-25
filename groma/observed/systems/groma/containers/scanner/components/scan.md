---
id: scan
kind: component
parent: scanner
code:
  - scanner: typescript
    file: src/scanner.ts
    symbol: formatScanSummary
---

# Scan

Runs TypeScript and C# scanners to completion before handing their observations to core. If either scanner fails, no architecture Markdown is reconciled. A watch uses the same path after supported source changes settle.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [TypeScript scanner](typescript-scanner.md) | Collects TypeScript evidence | scanTypeScriptSource |
| [C# scanner](csharp-scanner.md) | Collects C# evidence | scanCSharpSource |
| [Scan reconciler](../../core/components/scan-reconciler.md) | Supplies the complete observation batch | reconcileScanObservations |
