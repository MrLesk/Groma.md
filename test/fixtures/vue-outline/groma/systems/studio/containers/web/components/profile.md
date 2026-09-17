---
type: C4 Component
title: Profile
status: stable
groma:
  id: profile
  parent: web
  code:
    - scanner: vue
      file: Profile.vue
    - scanner: vue
      file: greeting.ts
      symbol: greeting
    - scanner: typescript
      file: greeting.ts
---

Shows a member profile and greets the member.
