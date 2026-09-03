---
type: C4 Component
title: Sessions session
status: stable
groma:
  id: sessions-session
  parent: sessions
  group: Core
  code:
    - scanner: typescript
      file: src/identity/sessions/session.ts
      symbol: session
    - scanner: typescript
      file: src/identity/sessions/session-1.ts
      symbol: session
    - scanner: typescript
      file: src/identity/sessions/session-2.ts
      symbol: session
---

Sessions session of Sessions.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [sessions-cache](sessions-cache.md) | Calls cache | HTTP |
| [sessions-validator](sessions-validator.md) | Reads validator | HTTP |
