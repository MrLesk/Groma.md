---
type: C4 Component
title: Rust HTTP analysis
status: stable
groma:
  id: rust-http
  parent: rust-worker
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
description: Finds Rust HTTP clients and route handlers
---

Recognizes supported Rust HTTP clients and route handlers. Resolves literal URLs and router placement into request and provider evidence.
