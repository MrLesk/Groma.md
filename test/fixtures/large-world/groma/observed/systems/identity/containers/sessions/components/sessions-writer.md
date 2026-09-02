---
type: C4 Component
title: Sessions writer
status: stable
groma:
  id: sessions-writer
  parent: sessions
  group: Support
  code:
    - scanner: typescript
      file: src/identity/sessions/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/identity/sessions/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/identity/sessions/writer-2.ts
      symbol: writer
---

Sessions writer of Sessions.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [sessions-queue](sessions-queue.md) | Calls queue | HTTP |
| [sessions-worker](sessions-worker.md) | Reads worker | HTTP |
