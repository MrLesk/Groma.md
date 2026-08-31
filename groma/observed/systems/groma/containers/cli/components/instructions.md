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

Owns the shipped guide catalog and its Markdown source. Overview explains what Groma is and how source, architecture Markdown, and viewers connect. Authoring explains the supported workflow. The same catalog supplies interactive Instructions and stable plain-text guide output.
