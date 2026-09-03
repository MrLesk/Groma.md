---
type: C4 Component
title: Sessions gateway
status: stable
groma:
  id: sessions-gateway
  parent: sessions
  group: Core
  code:
    - scanner: typescript
      file: src/identity/sessions/gateway.ts
      symbol: gateway
---

Sessions gateway of Sessions.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [sessions-router](sessions-router.md) | Calls router | HTTP |
| [sessions-session](sessions-session.md) | Reads session | HTTP |
| [audit-gateway](../../../../identity/containers/audit/components/audit-gateway.md) | Forwards requests | HTTP |
