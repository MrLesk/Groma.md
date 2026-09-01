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
      dependencies: 3
      dependents: 9
    - scanner: typescript
      file: src/project-markdown.ts
      dependencies: 0
      dependents: 2
  group: Architecture storage
---

Strictly reads and saves project.md in the selected Groma root as a Groma Project concept with a standard title, optional concise description, explicit architecture profile marker, and long body overview. It preserves unowned metadata and derives the rich overview blocks used by the blueprint title plate.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Groma filesystem](groma-filesystem.md) | Reads and saves the project profile | Filesystem access |
