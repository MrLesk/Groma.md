---
id: architecture-reader
kind: component
parent: core
code:
  - scanner: typescript
    file: src/architecture-reader.ts
    symbol: loadRevision
---

# Architecture reader

Reads every element document under `groma/observed/` and every plan directory into revision records: frontmatter, Markdown body, and source filename. It is the only code that walks the `groma/` tree.
