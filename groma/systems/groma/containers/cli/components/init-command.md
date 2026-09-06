---
type: C4 Component
title: Init command
status: stable
groma:
  id: init-command
  parent: cli
  code:
    - scanner: typescript
      file: src/init-command.ts
    - scanner: typescript
      file: src/init-command-ui.ts
  group: Command surface
---

Runs the repeatable setup and settings journey. It owns the Groma-themed Clack prompts, optional Backlog.md installation, first-scan offer, and viewer handoff while delegating repository writes to project initialization.
