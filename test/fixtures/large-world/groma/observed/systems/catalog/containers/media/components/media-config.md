---
type: C4 Component
title: Media config
status: stable
groma:
  id: media-config
  parent: media
  code:
    - scanner: typescript
      file: src/catalog/media/config.ts
      symbol: config
    - scanner: typescript
      file: src/catalog/media/config-1.ts
      symbol: config
    - scanner: typescript
      file: src/catalog/media/config-2.ts
      symbol: config
---

Media config of Media.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [media-logger](media-logger.md) | Calls logger | HTTP |
| [media-client](media-client.md) | Reads client | HTTP |
