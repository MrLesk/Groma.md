---
type: C4 Component
title: Instructions
status: stable
groma:
  id: instructions
  parent: cli
  group: Command surface
  code:
    - scanner: typescript
      file: src/instructions.ts
      dependencies: 0
      dependents: 1
---

Owns the human Overview and Authoring guide catalog. It supplies the interactive Instructions screen and stable plain-text human guide output without mixing in agent operating rules.
