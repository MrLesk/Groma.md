---
type: C4 Component
title: Sessions logger
status: stable
groma:
  id: sessions-logger
  parent: sessions
  code:
    - scanner: typescript
      file: src/identity/sessions/logger.ts
      symbol: logger
    - scanner: typescript
      file: src/identity/sessions/logger-1.ts
      symbol: logger
    - scanner: typescript
      file: src/identity/sessions/logger-2.ts
      symbol: logger
    - scanner: typescript
      file: src/identity/sessions/logger-3.ts
      symbol: logger
---

Sessions logger of Sessions.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [sessions-client](sessions-client.md) | Calls client | HTTP |
