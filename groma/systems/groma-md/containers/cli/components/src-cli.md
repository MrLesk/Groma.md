---
type: C4 Component
title: Command interface
status: stable
groma:
  id: src-cli
  parent: cli
  code:
    - scanner: typescript
      file: src/cli.ts
    - scanner: typescript
      file: src/scanner/cli.ts
      symbol: registerScannerCommands
    - scanner: typescript
      file: src/write-commands.ts
      symbol: registerWriteCommands
  group: Project commands
---

Reads commands and options. Starts the selected project action and reports its result.
