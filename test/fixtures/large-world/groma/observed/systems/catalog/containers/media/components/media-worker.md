---
type: C4 Component
title: Media worker
status: stable
groma:
  id: media-worker
  parent: media
  group: Support
  code:
    - scanner: typescript
      file: src/catalog/media/worker.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/media/worker-1.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/media/worker-2.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/media/worker-3.ts
      symbol: worker
    - scanner: typescript
      file: src/catalog/media/worker-4.ts
      symbol: worker
---

Media worker of Media.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [media-scheduler](media-scheduler.md) | Calls scheduler | HTTP |
| [media-metrics](media-metrics.md) | Reads metrics | HTTP |
