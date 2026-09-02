---
type: C4 Component
title: Session Store mapper
status: stable
groma:
  id: session-store-mapper
  parent: session-store
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/session-store/mapper.ts
      symbol: mapper
---

Session Store mapper of Session Store.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [session-store-reader](session-store-reader.md) | Calls reader | HTTP |
| [session-store-writer](session-store-writer.md) | Reads writer | HTTP |
