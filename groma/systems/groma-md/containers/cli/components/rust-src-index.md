---
type: C4 Component
title: Rust scanner adapter
status: stable
groma:
  id: rust-src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/rust/src/index.ts
    - scanner: typescript
      file: plugins/scanners/rust/src/project.ts
  group: Language analysis
---

Selects Cargo projects and checks the Rust tools. Starts the Rust worker and reads its scan result.
