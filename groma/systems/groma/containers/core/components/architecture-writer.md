---
type: C4 Component
title: Architecture writer
status: stable
groma:
  id: architecture-writer
  parent: core
  group: Architecture changes
  code:
    - scanner: typescript
      file: src/architecture-path.ts
    - scanner: typescript
      file: src/markdown-emitter.ts
---

Owns canonical C4 paths and OKF Markdown writes. It emits standard type,
title, optional description, and lifecycle status with one nested Groma
mapping and no duplicate title heading. Supported edits change only owned or
submitted fields while preserving unowned metadata, overview prose, named
sections, and strict relationship tables.
