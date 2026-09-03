---
type: C4 Component
title: Revision history
status: stable
groma:
  id: revision-history
  parent: web-viewer
  code:
    - scanner: typescript
      file: src/viewers/web/revision/control.ts
      symbol: createRevisionControl
      dependencies: 2
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/revision/view.ts
      dependencies: 2
      dependents: 1
---

Controls browser revision selection and presents current and historical options.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Revisions](../../view-host/components/revisions.md) | Reads and opens Groma revisions | TypeScript |
