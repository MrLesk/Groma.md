---
type: C4 Component
title: Sessions reader
status: stable
groma:
  id: sessions-reader
  parent: sessions
  group: Support
  code:
    - scanner: typescript
      file: src/identity/sessions/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/identity/sessions/reader-1.ts
      symbol: reader
---

Sessions reader of Sessions.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [sessions-writer](sessions-writer.md) | Calls writer | HTTP |
| [sessions-queue](sessions-queue.md) | Reads queue | HTTP |
