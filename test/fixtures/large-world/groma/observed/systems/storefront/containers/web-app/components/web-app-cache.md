---
type: C4 Component
title: Web App cache
status: stable
groma:
  id: web-app-cache
  parent: web-app
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/web-app/cache.ts
      symbol: cache
    - scanner: typescript
      file: src/storefront/web-app/cache-1.ts
      symbol: cache
    - scanner: typescript
      file: src/storefront/web-app/cache-2.ts
      symbol: cache
    - scanner: typescript
      file: src/storefront/web-app/cache-3.ts
      symbol: cache
---

Web App cache of Web App.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [web-app-validator](web-app-validator.md) | Calls validator | HTTP |
| [web-app-mapper](web-app-mapper.md) | Reads mapper | HTTP |
