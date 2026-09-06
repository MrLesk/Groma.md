---
type: Groma Relationships
title: Architecture relationships
---

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [Requester](actors/requester.md) | [Entry](systems/service/containers/api/components/entry.md) | Submits work | HTTP |
| [src/entry.ts](../src/entry.ts) | [src/worker.ts](../src/worker.ts) | Dispatches work | Function call |
| [Entry](systems/service/containers/api/components/entry.md) | [Journal](externals/journal.md) | Records activity | HTTP |
| [src/worker.ts](../src/worker.ts) | [src/entry.ts](../src/entry.ts) | Reports progress | Callback |
