---
id: markdown-emitter
kind: component
parent: core
group: Scan folding
code:
  - scanner: typescript
    file: src/markdown-emitter.ts
    symbol: omitCode
    dependencies: 1
    dependents: 4
---

# Markdown emitter

Writes observed architecture documents and refreshes Code frontmatter without rewriting curated prose. Every write of a `groma/` file goes through it.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Git](../../../../git/system.md) | Writes architecture for versioning | Markdown |
