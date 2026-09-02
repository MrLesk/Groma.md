---
type: C4 Component
title: Auth mapper
status: stable
groma:
  id: auth-mapper
  parent: auth
  group: Support
  code:
    - scanner: typescript
      file: src/identity/auth/mapper.ts
      symbol: mapper
---

Auth mapper of Auth.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [auth-reader](auth-reader.md) | Calls reader | HTTP |
| [auth-writer](auth-writer.md) | Reads writer | HTTP |
