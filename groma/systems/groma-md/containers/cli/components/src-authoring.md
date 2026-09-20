---
type: C4 Component
title: Architecture changes
status: stable
groma:
  id: src-authoring
  parent: cli
  code:
    - scanner: typescript
      file: src/authoring.ts
    - scanner: typescript
      file: src/add.ts
    - scanner: typescript
      file: src/edit.ts
    - scanner: typescript
      file: src/draft.ts
    - scanner: typescript
      file: src/accept.ts
    - scanner: typescript
      file: src/remove.ts
    - scanner: typescript
      file: src/removable.ts
  group: Architecture records
description: Validates and applies explicit architecture write commands
---

Applies add, edit, draft, accept, and remove actions. Checks each change before it writes the affected records.
