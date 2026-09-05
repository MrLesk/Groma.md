---
type: C4 Component
title: Web viewer details
status: stable
groma:
  id: web-viewer-details
  parent: web-viewer
  group: Web chrome
  code:
    - scanner: typescript
      file: src/viewers/web/organisms/details.ts
      dependencies: 14
      dependents: 3
---

Inspects the current architecture or task selection and paints its meaning, relationships, command flows, and build evidence.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Component tasks](component-tasks.md) | Delegates linked component task rows to the Work painter | DOM |
