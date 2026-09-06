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
    - scanner: typescript
      file: src/project-markdown.ts
  group: Architecture storage
---

Strictly reads and saves project.md in the selected Groma root as a Groma Project concept with a standard title, optional concise description, explicit architecture profile marker, and long body overview. It preserves unowned metadata and derives the rich overview blocks used by the blueprint title plate.
