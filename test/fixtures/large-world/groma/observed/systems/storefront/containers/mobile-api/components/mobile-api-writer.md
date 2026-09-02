---
type: C4 Component
title: Mobile Api writer
status: stable
groma:
  id: mobile-api-writer
  parent: mobile-api
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/mobile-api/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/storefront/mobile-api/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/storefront/mobile-api/writer-2.ts
      symbol: writer
---

Mobile Api writer of Mobile Api.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [mobile-api-queue](mobile-api-queue.md) | Calls queue | HTTP |
| [mobile-api-worker](mobile-api-worker.md) | Reads worker | HTTP |
