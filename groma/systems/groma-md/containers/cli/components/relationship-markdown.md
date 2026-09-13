---
type: C4 Component
title: Architecture relationships
status: stable
groma:
  id: relationship-markdown
  parent: cli
  code:
    - scanner: typescript
      file: src/relationship-markdown.ts
      symbol: storedConnections
    - scanner: typescript
      file: src/source-relationships.ts
    - scanner: typescript
      file: src/relation.ts
  group: Architecture records
---

Reads and writes directed interactions. Resolves exact source files to their component owners for display on the map.
