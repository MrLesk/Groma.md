---
type: C4 Component
title: Rust compiler analysis
status: stable
groma:
  id: rust-analysis
  parent: rust-worker
  code:
    - scanner: rust
      file: plugins/scanners/rust/native/src/main.rs
    - scanner: rust
      file: plugins/scanners/rust/native/src/scan.rs
    - scanner: rust
      file: plugins/scanners/rust/native/src/tokens.rs
    - scanner: rust
      file: plugins/scanners/rust/native/src/text.rs
description: Loads a Cargo crate graph with rust-analyzer and returns scan evidence
---

Loads the declared source crate graph with rust-analyzer. Returns source declarations, operation bodies and supported call evidence for the scanner result.
