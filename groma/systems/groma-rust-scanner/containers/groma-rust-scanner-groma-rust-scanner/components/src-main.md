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
---

Loads the selected Cargo project with rust-analyzer. Writes source declarations and supported call evidence as a scanner result.
