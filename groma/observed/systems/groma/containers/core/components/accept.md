---
type: C4 Component
title: Accept
status: stable
groma:
  id: accept
  parent: core
  group: Architecture changes
  code:
    - scanner: typescript
      file: src/accept.ts
      dependencies: 7
      dependents: 1
---

Applies a scan-matched draft concept to observed architecture, preserves its
stable identity and complete authored OKF document, attaches the matching Code
evidence, changes lifecycle status to stable, and removes the planned file.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture reader](architecture-reader.md) | Finds the planned and observed records | In-process data |
| [Architecture writer](architecture-writer.md) | Writes the accepted document | In-process data |
| [Scan lifecycle](../../scanner/components/scan-lifecycle.md) | Uses complete scan evidence for matching | In-process data |
