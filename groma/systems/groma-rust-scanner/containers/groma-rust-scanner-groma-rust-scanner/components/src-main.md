---
type: C4 Component
title: Rust compiler analysis
status: stable
groma:
  id: src-main
  parent: groma-rust-scanner-groma-rust-scanner
  code:
    - scanner: rust
      file: plugins/scanners/rust/native/src/main.rs
    - scanner: rust
      file: plugins/scanners/rust/native/src/scan.rs
    - scanner: rust
      file: plugins/scanners/rust/native/src/tokens.rs
    - scanner: rust
      file: plugins/scanners/rust/native/src/text.rs
---

Loads the declared source crate graph with rust-analyzer. Returns source declarations, operation bodies and supported call evidence for the scanner result.
