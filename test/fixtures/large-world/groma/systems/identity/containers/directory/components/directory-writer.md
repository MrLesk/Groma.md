---
type: C4 Component
title: Directory writer
status: stable
groma:
  id: directory-writer
  parent: directory
  group: Support
  code:
    - scanner: typescript
      file: src/identity/directory/writer.ts
      symbol: writer
    - scanner: typescript
      file: src/identity/directory/writer-1.ts
      symbol: writer
    - scanner: typescript
      file: src/identity/directory/writer-2.ts
      symbol: writer
---

Directory writer of Directory.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [directory-queue](directory-queue.md) | Calls queue | HTTP |
| [directory-worker](directory-worker.md) | Reads worker | HTTP |
