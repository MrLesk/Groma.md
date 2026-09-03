---
type: C4 Component
title: Web App validator
status: stable
groma:
  id: web-app-validator
  parent: web-app
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/web-app/validator.ts
      symbol: validator
    - scanner: typescript
      file: src/storefront/web-app/validator-1.ts
      symbol: validator
    - scanner: typescript
      file: src/storefront/web-app/validator-2.ts
      symbol: validator
    - scanner: typescript
      file: src/storefront/web-app/validator-3.ts
      symbol: validator
    - scanner: typescript
      file: src/storefront/web-app/validator-4.ts
      symbol: validator
---

Web App validator of Web App.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [web-app-mapper](web-app-mapper.md) | Calls mapper | HTTP |
| [web-app-reader](web-app-reader.md) | Reads reader | HTTP |
