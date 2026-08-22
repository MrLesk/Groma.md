---
id: scanner
kind: container
parent: groma
technology: TypeScript import graph
code:
  - scanner: typescript
    file: src/scanner.ts
    symbol: formatScanSummary
---

# Scanner

Runs a scan once or as a watch: the language plugin reads the repository, core folds the candidates into Markdown, and the command prints `ok` with a short summary. It never writes architecture Markdown itself and never invents an architecture id.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Scan reconciler](../core/components/scan-reconciler.md) | Supplies scan results to fold | In-process data |
