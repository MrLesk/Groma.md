---
type: C4 Component
title: Draft
status: stable
groma:
  id: draft
  parent: cli
  code:
    - scanner: typescript
      file: src/draft.ts
    - scanner: typescript
      file: src/naming.ts
  group: Architecture authoring
---

Drafts a new system, container, or component as a ghost at the path it will keep once accepted. The kind is checked against the parent, the id is the kebab-case of the name, and an optional draft record names the outcome the ghost belongs to.
