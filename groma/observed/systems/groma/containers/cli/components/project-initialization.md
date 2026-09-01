---
type: C4 Component
title: Project initialization
status: stable
groma:
  id: project-initialization
  parent: cli
  code:
    - scanner: typescript
      file: src/initialize.ts
      dependencies: 3
      dependents: 1
  group: Command surface
---

Initializes a repository with its project identity, selected Groma storage root, minimum architecture package, and managed agent instructions after validating all required choices before writing.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Groma filesystem](../../core/components/groma-filesystem.md) | Selects the repository's architecture root and writes the minimum package | Filesystem access |
| [Project profile](../../core/components/project-profile.md) | Renders the project identity profile | Project profile |
| [Agent instructions](agent-instructions.md) | Reconciles the managed repository instruction block | Initialization |
