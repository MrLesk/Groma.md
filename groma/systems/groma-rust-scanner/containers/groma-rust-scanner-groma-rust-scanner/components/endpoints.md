---
type: C4 Component
title: Rust HTTP analysis
status: stable
groma:
  id: endpoints
  parent: groma-rust-scanner-groma-rust-scanner
  code:
    - scanner: rust
      file: plugins/scanners/rust/native/src/endpoints.rs
    - scanner: rust
      file: plugins/scanners/rust/native/src/client.rs
    - scanner: rust
      file: plugins/scanners/rust/native/src/handlers.rs
    - scanner: rust
      file: plugins/scanners/rust/native/src/patterns.rs
    - scanner: rust
      file: plugins/scanners/rust/native/src/placement.rs
    - scanner: rust
      file: plugins/scanners/rust/native/src/requests.rs
    - scanner: rust
      file: plugins/scanners/rust/native/src/url.rs
---

Recognizes supported Rust HTTP clients and route handlers. Resolves literal URLs and router placement into request and provider evidence.
