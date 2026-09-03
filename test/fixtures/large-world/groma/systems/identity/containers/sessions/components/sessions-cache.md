---
type: C4 Component
title: Sessions cache
status: stable
groma:
  id: sessions-cache
  parent: sessions
  group: Core
  code:
    - scanner: typescript
      file: src/identity/sessions/cache.ts
      symbol: cache
    - scanner: typescript
      file: src/identity/sessions/cache-1.ts
      symbol: cache
    - scanner: typescript
      file: src/identity/sessions/cache-2.ts
      symbol: cache
    - scanner: typescript
      file: src/identity/sessions/cache-3.ts
      symbol: cache
---

Sessions cache of Sessions.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [sessions-validator](sessions-validator.md) | Calls validator | HTTP |
| [sessions-mapper](sessions-mapper.md) | Reads mapper | HTTP |
