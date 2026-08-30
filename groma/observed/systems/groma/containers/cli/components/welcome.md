---
id: welcome
kind: component
parent: cli
code:
  - scanner: typescript
    file: src/welcome.ts
    dependencies: 1
    dependents: 1
---

# Welcome

Owns the bare groma repository welcome. It builds one repository context and ordered action list, prints stable plain text without a TTY, and mounts the keyboard-driven technical sheet in a terminal. The launcher returns the selected action to Commands after restoring the terminal.
