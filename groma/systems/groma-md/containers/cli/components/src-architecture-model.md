---
type: C4 Component
title: Architecture model
status: stable
groma:
  id: src-architecture-model
  parent: cli
  code:
    - scanner: typescript
      file: src/architecture-model.ts
    - scanner: typescript
      file: src/okf-profile.ts
    - scanner: typescript
      file: src/code-reference.ts
      symbol: codeReferencesOf
    - scanner: typescript
      file: src/types.ts
    - scanner: typescript
      file: src/architecture-path.ts
    - scanner: typescript
      file: src/naming.ts
  group: Architecture records
description: Builds the in-memory C4 model from stored Markdown records
---

Checks element identity, status, and C4 parent rules. Builds the shared architecture model from the stored records.
