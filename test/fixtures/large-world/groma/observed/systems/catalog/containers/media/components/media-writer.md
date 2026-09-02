---
type: C4 Component
title: Media writer
status: stable
groma:
  id: media-writer
  parent: media
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/media/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/catalog/media/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/catalog/media/writer-2.ts
      symbol: writer
---

Media writer of Media.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [media-queue](media-queue.md) | Calls queue | HTTP |
| [media-worker](media-worker.md) | Reads worker | HTTP |
