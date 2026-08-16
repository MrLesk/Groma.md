---
id: scanner
kind: container
parent: groma
code:
  - scanner: typescript
    file: src/scanner.ts
    symbol: formatScanSummary
---

# Scanner

Produces recognizable source observations and high-level Code references. It does not write architecture Markdown.

## Technology

Local scanner runtime and language plugins.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Core](../core/container.md) | Supplies scan results | In-process data |
