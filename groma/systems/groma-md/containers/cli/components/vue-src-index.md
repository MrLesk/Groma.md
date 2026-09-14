---
type: C4 Component
title: Vue analysis
status: stable
groma:
  id: vue-src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/vue/src/index.ts
      symbol: scanVue
    - scanner: typescript
      file: plugins/scanners/vue/src/project.ts
    - scanner: typescript
      file: plugins/scanners/vue/src/evidence.ts
      symbol: VueEvidence
  group: Language analysis
---

Reads Vue source and template data. Returns declarations and event callback evidence.
