---
type: C4 Component
title: Session Store reader
status: stable
groma:
  id: session-store-reader
  parent: session-store
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/session-store/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/storefront/session-store/reader-1.ts
      symbol: reader
---

Session Store reader of Session Store.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [session-store-writer](session-store-writer.md) | Calls writer | HTTP |
| [session-store-queue](session-store-queue.md) | Reads queue | HTTP |
