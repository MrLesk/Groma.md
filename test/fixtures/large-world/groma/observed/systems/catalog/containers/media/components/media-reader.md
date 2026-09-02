---
type: C4 Component
title: Media reader
status: stable
groma:
  id: media-reader
  parent: media
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/media/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/catalog/media/reader-1.ts
      symbol: reader
---

Media reader of Media.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [media-writer](media-writer.md) | Calls writer | HTTP |
| [media-queue](media-queue.md) | Reads queue | HTTP |
