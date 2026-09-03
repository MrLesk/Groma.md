---
type: C4 Component
title: Auth reader
status: stable
groma:
  id: auth-reader
  parent: auth
  group: Support
  code:
    - scanner: typescript
      file: src/identity/auth/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/identity/auth/reader-1.ts
      symbol: reader
---

Auth reader of Auth.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [auth-writer](auth-writer.md) | Calls writer | HTTP |
| [auth-queue](auth-queue.md) | Reads queue | HTTP |
