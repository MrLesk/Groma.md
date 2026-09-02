---
type: C4 Component
title: Directory queue
status: stable
groma:
  id: directory-queue
  parent: directory
  group: Support
  code:
    - scanner: typescript
      file: src/identity/directory/queue.ts
      symbol: queue
    - scanner: typescript
      file: src/identity/directory/queue-1.ts
      symbol: queue
    - scanner: typescript
      file: src/identity/directory/queue-2.ts
      symbol: queue
    - scanner: typescript
      file: src/identity/directory/queue-3.ts
      symbol: queue
---

Directory queue of Directory.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [directory-worker](directory-worker.md) | Calls worker | HTTP |
| [directory-scheduler](directory-scheduler.md) | Reads scheduler | HTTP |
