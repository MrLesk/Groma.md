---
type: C4 Component
title: Session Store writer
status: stable
groma:
  id: session-store-writer
  parent: session-store
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/session-store/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/storefront/session-store/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/storefront/session-store/writer-2.ts
      symbol: writer
---

Session Store writer of Session Store.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [session-store-queue](session-store-queue.md) | Calls queue | HTTP |
| [session-store-worker](session-store-worker.md) | Reads worker | HTTP |
