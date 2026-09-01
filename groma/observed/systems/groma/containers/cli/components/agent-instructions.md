---
type: C4 Component
title: Agent instructions
status: stable
groma:
  id: agent-instructions
  parent: cli
  group: Command surface
  code:
    - scanner: typescript
      file: src/agent-instructions.ts
      dependencies: 0
      dependents: 1
---

Owns the separate, always-plain catalog of agent operating rules and the explicit repository registration that installs its managed nudge in root agent-instruction files.
