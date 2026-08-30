---
id: project-profile
kind: component
parent: "core"
code:
  - scanner: typescript
    file: src/project-profile.ts
    dependencies: 1
    dependents: 6
  - scanner: typescript
    file: src/project-markdown.ts
    dependencies: 0
    dependents: 2
---

# Project profile

Strictly reads and saves the project-owned Groma README as one name and Markdown description, and derives the rich blocks used by the blueprint title plate.
