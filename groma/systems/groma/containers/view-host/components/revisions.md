---
type: C4 Component
title: Revisions
status: stable
groma:
  id: revisions
  parent: view-host
  code:
    - scanner: typescript
      file: src/history/revisions.ts
      dependencies: 4
      dependents: 9
---

Lists compatible and unsupported Groma commits and loads exact read-only repository snapshots for both viewers.
