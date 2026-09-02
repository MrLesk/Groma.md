---
type: C4 Component
title: Audit reader
status: stable
groma:
  id: audit-reader
  parent: audit
  group: Support
  code:
    - scanner: typescript
      file: src/identity/audit/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/identity/audit/reader-1.ts
      symbol: reader
---

Audit reader of Audit.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [audit-writer](audit-writer.md) | Calls writer | HTTP |
| [audit-queue](audit-queue.md) | Reads queue | HTTP |
