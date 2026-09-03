---
type: C4 Component
title: Media scheduler
status: stable
groma:
  id: media-scheduler
  parent: media
  code:
    - scanner: typescript
      file: src/catalog/media/scheduler.ts
      symbol: scheduler
---

Media scheduler of Media.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [media-metrics](media-metrics.md) | Calls metrics | HTTP |
| [media-config](media-config.md) | Reads config | HTTP |
