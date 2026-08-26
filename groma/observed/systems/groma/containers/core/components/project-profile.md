---
id: project-profile
kind: component
parent: core
code:
  - scanner: typescript
    file: src/project-profile.ts
    symbol: parseProjectProfile
    dependencies: 1
    dependents: 6
  - scanner: typescript
    file: src/project-markdown.ts
    dependencies: 0
    dependents: 2
---

# Project profile

Strictly parses and saves the project-owned `groma/README.md` as one name and Markdown description, and derives the rich-text blocks projected by the title plate. Tolerant loading returns no profile when the document is missing or invalid so optional profile UI can be omitted.
