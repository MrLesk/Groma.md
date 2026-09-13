---
type: C4 Component
title: Project setup
status: stable
groma:
  id: src-initialize
  parent: cli
  code:
    - scanner: typescript
      file: src/initialize.ts
    - scanner: typescript
      file: src/init-command.ts
    - scanner: typescript
      file: src/init-command-ui.ts
    - scanner: typescript
      file: src/project-profile.ts
    - scanner: typescript
      file: src/project-markdown.ts
  group: Project commands
---

Creates the project records. Checks the project tools and guides the user through scanner selection.
