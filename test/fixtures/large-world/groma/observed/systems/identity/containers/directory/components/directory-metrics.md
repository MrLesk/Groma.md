---
type: C4 Component
title: Directory metrics
status: stable
groma:
  id: directory-metrics
  parent: directory
  code:
    - scanner: typescript
      file: src/identity/directory/metrics.ts
      symbol: metrics
    - scanner: typescript
      file: src/identity/directory/metrics-1.ts
      symbol: metrics
---

Directory metrics of Directory.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [directory-config](directory-config.md) | Calls config | HTTP |
| [directory-logger](directory-logger.md) | Reads logger | HTTP |
