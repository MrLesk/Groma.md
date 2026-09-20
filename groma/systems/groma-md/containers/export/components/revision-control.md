---
type: C4 Component
title: Revision selector
status: stable
groma:
  id: revision-control
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/revision/control.ts
      symbol: createRevisionControl
    - scanner: typescript
      file: src/viewers/web/revision/view.ts
  group: Architecture panels
description: Lists Git architecture revisions and opens a snapshot
---

Lists available Git revisions and opens the selected architecture snapshot.
