---
type: C4 Component
title: Edit
status: stable
groma:
  id: edit
  parent: cli
  group: Architecture authoring
  code:
    - scanner: typescript
      file: src/edit.ts
      symbol: editArchitecture
---

Changes authored meaning by id: the lead overview or concise description of an element or a draft record, the draft tag that says which draft touches an element, and the structural curation of scanned evidence (group, ungroup, move, combine). It preserves unowned OKF metadata, nested Groma metadata outside the requested change, and every named Markdown section.
