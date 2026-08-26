---
id: accept
kind: component
parent: core
code:
  - scanner: typescript
    file: src/accept.ts
    symbol: acceptGhost
    dependencies: 4
    dependents: 1
---

# Accept

Applies a matched planned ghost into observed architecture: a new id becomes an observed document, a restated id updates the existing one, the matching Code is written, and the planned file is removed. It refuses when no scan has matched the id.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture reader](architecture-reader.md) | Finds the ghost and its observed match | In-process data |
| [Scan reconciler](scan-reconciler.md) | Runs the matching scan when asked | In-process data |
| [Markdown emitter](markdown-emitter.md) | Writes the accepted document | In-process data |
