---
type: C4 Component
title: Legacy ordering
status: stable
groma:
  id: legacy
  parent: api
  code:
    - scanner: typescript
      file: src/legacy.ts
---

Retains the last known legacy ordering responsibility.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Orders](orders.md) | Delegates current orders | Function call |
