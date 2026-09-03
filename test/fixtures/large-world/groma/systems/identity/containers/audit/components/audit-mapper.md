---
type: C4 Component
title: Audit mapper
status: stable
groma:
  id: audit-mapper
  parent: audit
  group: Support
  code:
    - scanner: typescript
      file: src/identity/audit/mapper.ts
      symbol: mapper
---

Audit mapper of Audit.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [audit-reader](audit-reader.md) | Calls reader | HTTP |
| [audit-writer](audit-writer.md) | Reads writer | HTTP |
