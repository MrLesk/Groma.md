---
type: C4 Component
title: Media cache
status: stable
groma:
  id: media-cache
  parent: media
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/media/cache.ts
      symbol: cache
    - scanner: typescript
      file: src/catalog/media/cache-1.ts
      symbol: cache
    - scanner: typescript
      file: src/catalog/media/cache-2.ts
      symbol: cache
    - scanner: typescript
      file: src/catalog/media/cache-3.ts
      symbol: cache
---

Media cache of Media.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [media-validator](media-validator.md) | Calls validator | HTTP |
| [media-mapper](media-mapper.md) | Reads mapper | HTTP |
