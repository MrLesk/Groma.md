---
type: C4 Component
title: Plain text view
status: stable
groma:
  id: plain-text-view
  parent: cli
  group: Command surface
  code:
    - scanner: typescript
      file: src/plain-world.ts
---

Prints a compact architecture overview with component group names and a flow index. Resolves element IDs, flow IDs, and exact source-file ownership to complete authored Markdown through the core document reader. Keeps a draft outcome and membership summary. Reads never scan or write architecture.
