---
type: C4 Component
title: Duplicate review panel
status: stable
groma:
  id: review-control
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/review/control.ts
    - scanner: typescript
      file: src/viewers/web/duplicates/control.ts
      symbol: createDuplicatesControl
    - scanner: typescript
      file: src/viewers/web/duplicates/model.ts
    - scanner: typescript
      file: src/viewers/web/duplicates/view.ts
  group: Architecture panels
description: Shows possible duplicate operations and their source comparison
---

Shows possible copies of source operations. Lets the user compare their code before deciding whether a change is needed.
