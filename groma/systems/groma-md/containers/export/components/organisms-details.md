---
type: C4 Component
title: Architecture details
status: stable
groma:
  id: organisms-details
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/organisms/details.ts
    - scanner: typescript
      file: src/viewers/web/organisms/code-lists.ts
      symbol: codeList
    - scanner: typescript
      file: src/viewers/web/organisms/relationship-card.ts
    - scanner: typescript
      file: src/viewers/web/organisms/relationship-details.ts
      symbol: paintRelationship
    - scanner: typescript
      file: src/viewers/web/organisms/editable.ts
    - scanner: typescript
      file: src/viewers/web/organisms/sidebar-section.ts
      symbol: sectionHeading
    - scanner: typescript
      file: src/viewers/web/comparison/details.ts
  group: Architecture panels
description: Shows the selected element, its source and its relationships
---

Shows the selected element, its source files, and its relationships. Lets the user read or edit the element meaning.
