---
id: architecture-writer
kind: component
parent: core
group: "Architecture changes"
code:
  - scanner: typescript
    file: src/architecture-path.ts
    dependencies: 1
    dependents: 4
  - scanner: typescript
    file: src/markdown-emitter.ts
    dependencies: 1
    dependents: 6
---

# Architecture writer

Owns architecture document paths and Markdown writes. It creates element documents, rewrites supported frontmatter and relationships, and preserves authored prose outside the requested change.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Git](../../../../git/system.md) | Writes architecture for versioning | Markdown |
