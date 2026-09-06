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
  group: Command surface
---

Initializes a repository with its project identity, selected Groma storage root, minimum architecture package, and managed agent instructions after validating all required choices before writing.
