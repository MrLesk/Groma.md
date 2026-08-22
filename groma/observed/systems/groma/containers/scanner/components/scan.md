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

Runs one scan, or a watch that scans again once source changes settle: asks the plugin for candidates, hands them to core to fold into Markdown, and reports how many documents were created, refreshed or matched.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Scanner plugin](scanner-plugin.md) | Asks for C4 candidates | scanTypeScriptSource |
| [Scan reconciler](../../core/components/scan-reconciler.md) | Supplies scan results to fold | foldScanResult |
