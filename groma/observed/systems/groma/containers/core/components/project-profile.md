---
type: C4 Component
title: Project profile
status: stable
groma:
  id: project-profile
  parent: core
  code:
    - scanner: typescript
      file: src/project-profile.ts
      dependencies: 2
      dependents: 8
    - scanner: typescript
      file: src/project-markdown.ts
      dependencies: 0
      dependents: 2
---

Strictly reads and saves `groma/project.md` as a `Groma Project` concept with
standard title, optional concise description, the explicit architecture
profile marker, and a long body overview. It preserves unowned metadata and
derives the rich overview blocks used by the blueprint title plate.
