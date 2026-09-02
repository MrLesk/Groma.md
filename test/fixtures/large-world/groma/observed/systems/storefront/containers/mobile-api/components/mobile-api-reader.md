---
type: C4 Component
title: Mobile Api reader
status: stable
groma:
  id: mobile-api-reader
  parent: mobile-api
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/mobile-api/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/storefront/mobile-api/reader-1.ts
      symbol: reader
---

Mobile Api reader of Mobile Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [mobile-api-writer](mobile-api-writer.md) | Calls writer | HTTP |
| [mobile-api-queue](mobile-api-queue.md) | Reads queue | HTTP |
