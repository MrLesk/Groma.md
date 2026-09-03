---
type: C4 Component
title: Directory mapper
status: stable
groma:
  id: directory-mapper
  parent: directory
  group: Support
  code:
    - scanner: typescript
      file: src/identity/directory/mapper.ts
      symbol: mapper
---

Directory mapper of Directory.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [directory-reader](directory-reader.md) | Calls reader | HTTP |
| [directory-writer](directory-writer.md) | Reads writer | HTTP |
