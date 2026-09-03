---
type: C4 Component
title: Directory logger
status: stable
groma:
  id: directory-logger
  parent: directory
  code:
    - scanner: typescript
      file: src/identity/directory/logger.ts
      symbol: logger
    - scanner: typescript
      file: src/identity/directory/logger-1.ts
      symbol: logger
    - scanner: typescript
      file: src/identity/directory/logger-2.ts
      symbol: logger
    - scanner: typescript
      file: src/identity/directory/logger-3.ts
      symbol: logger
---

Directory logger of Directory.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [directory-client](directory-client.md) | Calls client | HTTP |
