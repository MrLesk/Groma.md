---
type: C4 Component
title: Commands
status: stable
groma:
  id: commands
  parent: cli
  group: Command surface
  code:
    - scanner: typescript
      file: src/cli.ts
---

Routes every named Groma command and the bare-terminal launcher to one owning operation. It starts viewers, runs scans, authors architecture, and prints command results without deciding architecture meaning.
