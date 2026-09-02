---
type: C4 Component
title: Web App gateway
status: stable
groma:
  id: web-app-gateway
  parent: web-app
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/web-app/gateway.ts
      symbol: gateway
---

Web App gateway of Web App.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [web-app-router](web-app-router.md) | Calls router | HTTP |
| [web-app-session](web-app-session.md) | Reads session | HTTP |
| [mobile-api-gateway](../../../../storefront/containers/mobile-api/components/mobile-api-gateway.md) | Forwards requests | HTTP |
