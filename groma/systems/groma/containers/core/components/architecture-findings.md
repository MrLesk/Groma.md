---
type: C4 Component
title: Architecture findings
status: stable
groma:
  id: architecture-findings
  parent: core
  code:
    - scanner: typescript
      file: src/architecture-findings.ts
  group: Architecture world
---

Compares binding-normalized operation tokens after a scan and reports duplicated or similar logic as review questions with component owners and source ranges. Viewers show copies next to those operations. Findings are not relationships and do not merge components.
