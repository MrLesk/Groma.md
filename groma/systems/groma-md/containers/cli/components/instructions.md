---
type: C4 Component
title: Command guides
status: stable
groma:
  id: instructions
  parent: cli
  code:
    - scanner: typescript
      file: src/instructions.ts
    - scanner: typescript
      file: src/agent-instructions.ts
    - scanner: typescript
      file: src/compiled-asset.ts
      symbol: compiledAsset
  group: Project commands
description: Supplies the human and agent guides shipped with Groma
---

Supplies the user guides and agent instructions. Adds the Groma instruction block to the project.
