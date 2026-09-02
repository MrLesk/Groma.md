---
type: C4 Component
title: Directory reader
status: stable
groma:
  id: directory-reader
  parent: directory
  group: Support
  code:
    - scanner: typescript
      file: src/identity/directory/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/identity/directory/reader-1.ts
      symbol: reader
---

Directory reader of Directory.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [directory-writer](directory-writer.md) | Calls writer | HTTP |
| [directory-queue](directory-queue.md) | Reads queue | HTTP |
