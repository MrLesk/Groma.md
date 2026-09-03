---
type: C4 Component
title: Media metrics
status: stable
groma:
  id: media-metrics
  parent: media
  code:
    - scanner: typescript
      file: src/catalog/media/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/catalog/media/metrics-1.ts
      symbol: metrics
---

Media metrics of Media.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [media-config](media-config.md) | Calls config | HTTP |
| [media-logger](media-logger.md) | Reads logger | HTTP |
