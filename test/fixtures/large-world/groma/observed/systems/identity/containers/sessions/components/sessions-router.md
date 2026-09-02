---
type: C4 Component
title: Sessions router
status: stable
groma:
  id: sessions-router
  parent: sessions
  group: Core
  code:
    - scanner: typescript
      file: src/identity/sessions/router.ts
      symbol: router
    - scanner: typescript
      file: src/identity/sessions/router-1.ts
      symbol: router
---

Sessions router of Sessions.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [sessions-session](sessions-session.md) | Calls session | HTTP |
| [sessions-cache](sessions-cache.md) | Reads cache | HTTP |
