---
type: C4 Component
title: Web App mapper
status: stable
groma:
  id: web-app-mapper
  parent: web-app
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/web-app/mapper.ts
      symbol: mapper
---

Web App mapper of Web App.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [web-app-reader](web-app-reader.md) | Calls reader | HTTP |
| [web-app-writer](web-app-writer.md) | Reads writer | HTTP |
