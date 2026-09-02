---
type: C4 Component
title: Media queue
status: stable
groma:
  id: media-queue
  parent: media
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/media/queue.ts
      symbol: queue
    - scanner: typescript
      file: src/catalog/media/queue-1.ts
      symbol: queue
    - scanner: typescript
      file: src/catalog/media/queue-2.ts
      symbol: queue
    - scanner: typescript
      file: src/catalog/media/queue-3.ts
      symbol: queue
---

Media queue of Media.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [media-worker](media-worker.md) | Calls worker | HTTP |
| [media-scheduler](media-scheduler.md) | Reads scheduler | HTTP |
