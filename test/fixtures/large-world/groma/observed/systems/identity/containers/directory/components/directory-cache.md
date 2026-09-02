---
type: C4 Component
title: Directory cache
status: stable
groma:
  id: directory-cache
  parent: directory
  group: Core
  code:
    - scanner: typescript
      file: src/identity/directory/cache.ts
      symbol: cache
    - scanner: typescript
      file: src/identity/directory/cache-1.ts
      symbol: cache
    - scanner: typescript
      file: src/identity/directory/cache-2.ts
      symbol: cache
    - scanner: typescript
      file: src/identity/directory/cache-3.ts
      symbol: cache
---

Directory cache of Directory.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [directory-validator](directory-validator.md) | Calls validator | HTTP |
| [directory-mapper](directory-mapper.md) | Reads mapper | HTTP |
