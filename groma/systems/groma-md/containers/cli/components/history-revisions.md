---
type: C4 Component
title: Revision history
status: stable
groma:
  id: history-revisions
  parent: cli
  code:
    - scanner: typescript
      file: src/history/revisions.ts
  group: Architecture records
description: Loads Git snapshots of architecture without changing working files
---

Reads architecture revisions from Git. Loads the selected revision for a viewer without changing the working files.
