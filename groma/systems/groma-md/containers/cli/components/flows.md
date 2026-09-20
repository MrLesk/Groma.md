---
type: C4 Component
title: Flow display data
status: stable
groma:
  id: flows
  parent: cli
  code:
    - scanner: typescript
      file: src/viewers/flows.ts
    - scanner: typescript
      file: src/viewers/relationship-text.ts
  group: Shared viewer data
description: Resolves flow steps and labels for both viewers
---

Resolves flow steps and relationship labels for the viewers. Finds the elements and parent paths used by each flow.
