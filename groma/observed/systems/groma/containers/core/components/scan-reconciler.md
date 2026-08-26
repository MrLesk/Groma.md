---
id: scan-reconciler
kind: component
parent: core
group: Scan folding
code:
  - scanner: typescript
    file: src/scan-reconciler.ts
    symbol: readCode
    dependencies: 5
    dependents: 2
---

# Scan reconciler

Reconciles a complete batch of language observations with the curated architecture. Existing Code file membership stays together, supported symbols refresh in place, and each unknown file becomes separate evidence under its inferred scope. File-to-file source dependencies fold into dependency and dependent counts on each Code reference. Matching planned elements receive Code without being accepted.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture reader](architecture-reader.md) | Reads the current world before matching | In-process data |
| [Markdown emitter](markdown-emitter.md) | Writes new documents and refreshed Code | In-process data |
