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
description: Starts the Rust worker and converts its result into scan evidence
---

Reads Cargo source declarations and prepares the source crate graph. Starts the bundled Rust worker and returns its source analysis and outlines.
