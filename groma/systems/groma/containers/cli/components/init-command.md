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
      dependencies: 6
      dependents: 2
    - scanner: typescript
      file: src/init-command-ui.ts
      dependencies: 3
      dependents: 1
  group: Command surface
---

Runs the repeatable setup and settings journey. It owns the Groma-themed Clack prompts, optional Backlog.md installation, first-scan offer, and viewer handoff while delegating repository writes to project initialization.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Project initialization](project-initialization.md) | Loads and saves the project identity, storage root, minimum package, and managed agent instructions | Initialization |
| [Scan lifecycle](../../scanner/components/scan-lifecycle.md) | Runs the accepted first scan and reports what it found | Scanner |
| [Commands](commands.md) | Opens the selected viewer without scanning the repository a second time | CLI |
