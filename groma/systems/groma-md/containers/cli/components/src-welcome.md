---
type: C4 Component
title: Start screen
status: stable
groma:
  id: src-welcome
  parent: cli
  code:
    - scanner: typescript
      file: src/welcome.ts
    - scanner: typescript
      file: src/welcome/model.ts
    - scanner: typescript
      file: src/welcome/view.ts
    - scanner: typescript
      file: src/empty-world.ts
  group: Project commands
---

Shows the project state and the available commands. Opens the selected viewer or settings screen.
