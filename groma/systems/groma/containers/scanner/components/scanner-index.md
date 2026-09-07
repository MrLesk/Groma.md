---
type: C4 Component
title: Java scanner
status: stable
groma:
  id: scanner-index
  parent: scanner
  code:
    - scanner: typescript
      file: plugins/scanners/java/src/index.ts
    - scanner: typescript
      file: plugins/scanners/java/src/adapter.ts
    - scanner: typescript
      file: plugins/scanners/java/src/config.ts
  group: Language scanners
description: Opt-in Java source evidence through an isolated compiler worker
---

Reads an explicitly configured Java compilation source set and invokes the prebuilt javac-tree worker. Returns atomic source inventory, semantic source references and conservatively resolved operations; leaves virtual, framework and callback wiring unresolved. Does not evaluate builds, install dependencies or choose architecture relationships. The Java worker sources are outside the embedded TypeScript scanner coverage.
