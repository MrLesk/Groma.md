---
type: C4 Component
title: Architecture search
status: stable
groma:
  id: search
  parent: cli
  code:
    - scanner: typescript
      file: src/search.ts
  group: Shared viewer data
description: Indexes architecture elements for viewer search
---

Builds a shared search index for architecture elements. Returns matching elements with their parent paths.
