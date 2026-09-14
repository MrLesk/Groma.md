---
type: C4 Component
title: Scanner settings
status: stable
groma:
  id: modules-settings
  parent: cli
  code:
    - scanner: typescript
      file: src/scanner/modules/settings.ts
    - scanner: typescript
      file: src/scanner/modules/settings-model.ts
    - scanner: typescript
      file: src/scanner/modules/setup.ts
  group: Scanner management
---

Builds the shared scanner settings state. Applies install, update, and remove actions after user selection.
