---
id: core
kind: container
parent: groma
technology: comark, ELK
code:
  - scanner: typescript
    file: src/core.ts
    symbol: annotateArchitecture
---

# Core

Owns architecture identity. It reads observed and planned Markdown, merges every revision into one annotated world, weighs components by the lines behind their code, lays the world out for the viewers, folds scan results back into Markdown, and applies accepted ghosts. No other runtime reads or writes `groma/`.
