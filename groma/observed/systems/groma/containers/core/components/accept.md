---
id: accept
kind: component
parent: core
group: "Architecture changes"
code:
  - scanner: typescript
    file: src/accept.ts
    dependencies: 5
    dependents: 1
---

# Accept

Applies a scan-matched planned element to observed architecture, preserving its stable identity, writing its evidence, and removing the planned document.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture reader](architecture-reader.md) | Finds the planned and observed records | In-process data |
| [Architecture writer](architecture-writer.md) | Writes the accepted document | In-process data |
| [Scan lifecycle](../../scanner/components/scan-lifecycle.md) | Uses complete scan evidence for matching | In-process data |
