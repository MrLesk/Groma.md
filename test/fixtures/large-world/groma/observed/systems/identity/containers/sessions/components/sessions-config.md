---
type: C4 Component
title: Sessions config
status: stable
groma:
  id: sessions-config
  parent: sessions
  code:
    - scanner: typescript
      file: src/identity/sessions/config.ts
      symbol: config
    - scanner: typescript
      file: src/identity/sessions/config-1.ts
      symbol: config
    - scanner: typescript
      file: src/identity/sessions/config-2.ts
      symbol: config
---

Sessions config of Sessions.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [sessions-logger](sessions-logger.md) | Calls logger | HTTP |
| [sessions-client](sessions-client.md) | Reads client | HTTP |
