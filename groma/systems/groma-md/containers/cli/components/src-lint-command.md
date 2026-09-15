---
type: C4 Component
title: Lint command
status: stable
groma:
  id: src-lint-command
  parent: cli
  code:
    - scanner: typescript
      file: src/lint-command.ts
      symbol: registerLintCommand
  group: Project commands
---

Registers groma lint and checks current scanner evidence for possible duplicate logic. Reports findings and scan failures through the command exit status without changing saved architecture.
