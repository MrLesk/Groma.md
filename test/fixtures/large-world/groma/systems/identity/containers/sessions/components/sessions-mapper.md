---
type: C4 Component
title: Sessions mapper
status: stable
groma:
  id: sessions-mapper
  parent: sessions
  group: Support
  code:
    - scanner: typescript
      file: src/identity/sessions/mapper.ts
      symbol: mapper
---

Sessions mapper of Sessions.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [sessions-reader](sessions-reader.md) | Calls reader | HTTP |
| [sessions-writer](sessions-writer.md) | Reads writer | HTTP |
