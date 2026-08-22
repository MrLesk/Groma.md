---
id: scan-reconciler
kind: component
parent: core
group: Scan folding
code:
  - scanner: typescript
    file: src/scan-reconciler.ts
    symbol: foldScanResult
---

# Scan reconciler

Matches scanner results to elements that already exist, refreshes only Code frontmatter after curation, attaches Code to a matching ghost without accepting it, and assigns a readable id only to a new observation that is not already in the world.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture reader](architecture-reader.md) | Reads the current world before matching | In-process data |
| [Markdown emitter](markdown-emitter.md) | Writes new documents and refreshed Code | In-process data |
