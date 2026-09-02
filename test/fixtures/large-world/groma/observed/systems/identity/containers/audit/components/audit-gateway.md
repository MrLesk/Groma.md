---
type: C4 Component
title: Audit gateway
status: stable
groma:
  id: audit-gateway
  parent: audit
  group: Core
  code:
    - scanner: typescript
      file: src/identity/audit/gateway.ts
      symbol: gateway
---

Audit gateway of Audit.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [audit-router](audit-router.md) | Calls router | HTTP |
| [audit-session](audit-session.md) | Reads session | HTTP |
| [web-app-gateway](../../../../storefront/containers/web-app/components/web-app-gateway.md) | Forwards requests | HTTP |
