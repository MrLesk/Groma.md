---
type: C4 Component
title: Auth writer
status: stable
groma:
  id: auth-writer
  parent: auth
  group: Support
  code:
    - scanner: typescript
      file: src/identity/auth/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/identity/auth/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/identity/auth/writer-2.ts
      symbol: writer
---

Auth writer of Auth.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [auth-queue](auth-queue.md) | Calls queue | HTTP |
| [auth-worker](auth-worker.md) | Reads worker | HTTP |
