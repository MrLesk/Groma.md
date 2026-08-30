---
id: architecture-reader
kind: component
parent: core
group: "Architecture world"
code:
  - scanner: typescript
    file: src/architecture-reader.ts
    dependencies: 1
    dependents: 8
---

# Architecture reader

Reads every architecture Markdown document into deterministic revision records. It is the only owner that walks the Groma architecture tree.
