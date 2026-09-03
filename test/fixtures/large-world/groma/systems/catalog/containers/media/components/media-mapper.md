---
type: C4 Component
title: Media mapper
status: stable
groma:
  id: media-mapper
  parent: media
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/media/mapper.ts
      symbol: mapper
---

Media mapper of Media.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [media-reader](media-reader.md) | Calls reader | HTTP |
| [media-writer](media-writer.md) | Reads writer | HTTP |
