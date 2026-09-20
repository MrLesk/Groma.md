---
type: C4 Component
title: Work source contract
status: stable
groma:
  id: work-source-src-index
  parent: cli
  code:
    - scanner: typescript
      file: packages/work-source/src/index.ts
  group: Project work
description: Defines the plugin contract for reading project tasks
---

Defines task records and update subscriptions for work source plugins. Supplies an empty result when no work source is active.
