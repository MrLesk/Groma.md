---
type: C4 Component
title: Directory scheduler
status: stable
groma:
  id: directory-scheduler
  parent: directory
  code:
    - scanner: typescript
      file: src/identity/directory/scheduler.ts
      symbol: scheduler
---

Directory scheduler of Directory.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [directory-metrics](directory-metrics.md) | Calls metrics | HTTP |
| [directory-config](directory-config.md) | Reads config | HTTP |
