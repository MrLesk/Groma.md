---
id: TASK-228.5
title: Prototype Rust scanning and document production delivery
status: Done
assignee:
  - '@rust-scanner-research'
created_date: '2026-09-07 22:05'
updated_date: '2026-09-07 22:38'
labels: []
dependencies: []
modified_files:
  - plugins/scanners/rust/native/Cargo.toml
  - plugins/scanners/rust/.gitignore
  - plugins/scanners/rust/native/src/model.rs
  - plugins/scanners/rust/native/src/source.rs
  - plugins/scanners/rust/native/src/cargo.rs
  - plugins/scanners/rust/native/src/index.rs
  - plugins/scanners/rust/native/src/modules.rs
  - plugins/scanners/rust/native/src/resolve.rs
  - plugins/scanners/rust/native/src/calls.rs
  - plugins/scanners/rust/native/src/callbacks.rs
  - plugins/scanners/rust/native/src/main.rs
  - plugins/scanners/rust/native/Cargo.lock
  - plugins/scanners/rust/package.json
  - plugins/scanners/rust/src/index.ts
  - plugins/scanners/rust/build.ts
  - bun.lock
  - test/fixtures/rust-scanner/groma/index.md
  - test/fixtures/rust-scanner/.gitignore
  - test/fixtures/rust-scanner/package.json
  - test/fixtures/rust-scanner/frontend/index.ts
  - test/fixtures/rust-scanner/frontend/transport.ts
  - test/fixtures/rust-scanner/backend/Cargo.toml
  - test/fixtures/rust-scanner/backend/src/lib.rs
  - test/fixtures/rust-scanner/backend/src/api.rs
  - test/fixtures/rust-scanner/backend/src/provider.rs
  - test/fixtures/rust-scanner/backend/src/worker.rs
  - plugins/scanners/rust/test/helpers.ts
  - plugins/scanners/rust/test/native.test.ts
  - plugins/scanners/rust/test/callbacks.test.ts
  - plugins/scanners/rust/test/integration.test.ts
  - test/fixtures/rust-scanner/groma/project.md
  - plugins/scanners/rust/smoke-compiled.ts
  - plugins/scanners/rust/notices.ts
  - plugins/scanners/rust/benchmark.ts
  - .github/workflows/rust-scanner.yml
  - .github/workflows/rust-research-workspace.yml
  - plugins/scanners/rust/scale-fixture.ts
  - plugins/scanners/rust/README.md
  - docs/scanners/rust/index.md
  - docs/scanners/rust/research.md
  - docs/scanners/rust/validation.json
  - docs/scanners/index.md
parent_task_id: TASK-228
type: spike
ordinal: 361000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers need a Rust backend and TypeScript frontend in one Groma map without installing a compiler just to inspect source. Research must distinguish source evidence from runtime claims and evaluate Cargo workspace and installation constraints before a production commitment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A native Rust prototype emits deterministic complete scanner observations for explicit Cargo source targets, canonical direct calls and a supplied named function-pointer callback example, preserving uncertainty for unsupported constructs.
- [x] #2 The existing Groma registry loads the optional Rust scanner alongside TypeScript and retains both languages and authored cross-language relationships across rescans; scanner failures prevent partial reconciliation.
- [x] #3 A staged standalone scanner package works without Cargo, rustc, npm or Node on the consumer PATH and never builds or downloads during scanning.
- [x] #4 Document production requirements, Rust-specific support boundaries, analyzer alternatives, installation design, primary references and measurements against a pinned external repository.
- [x] #5 Focused native and integration tests pass and bun run check is executed with any blockers reported accurately.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Implement a sidecar using pinned syn and TOML parsers, without running target code or Cargo. 2. Adapt its JSON through the existing scanner SDK and package a self-contained ESM adapter plus platform-native executable. 3. Verify canonical aliases, conservative unresolved evidence, named function-pointer wiring, atomic failures and mixed-language reconciliation. 4. Benchmark a pinned ripgrep clone and document the production semantic-analysis path and release gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a source-only syn/TOML native sidecar, bundled ESM adapter, standalone staging with dependency licenses, and existing-registry Rust/TypeScript integration. No existing runtime/core source was changed. Canonical alias and supplied immutable named function-pointer callback evidence is supported; method/trait dispatch, general value flow, cfg evaluation and macro/build execution are deliberately outside the declared scope. The compiler-checked #[path] module cases corrected the initial physical-directory assumption before final validation.

Validation: 36 focused concurrent tests / 85 assertions passed; cargo fmt --check and cargo clippy -- -D warnings passed; final bun run check passed 110 Node and 355 existing Bun tests with six existing Biome warnings. An initial check passed assertions but emitted a watcher teardown error. Untouched baseline and final changed check passed; cause unproven and watcher implementation was not altered. Final compiled-Groma smoke passed with only Git/Groma on consumer PATH and fresh HOME/TypeScript worker caches. Separate independent-agent reviews could not be executed and are not claimed.

Pinned ripgrep 14.1.1 (4649aa9700619f94cf9c66876e9549d83420e16c) cloned and scanned without building target code: 78 files, 10 scopes, 2078 operations, 5722 invocation observations, 81 resolved / 5641 unresolved, zero supported callback bindings. Release native 0.15-0.17 s and 32316-32444 KiB peak RSS in three fresh processes, caches not flushed. Synthetic 1001-file / 10000-call case 0.17-0.19 s. These are native syntax measurements, not end-to-end performance or a precision/recall benchmark. Full report, support boundaries, primary links and validation JSON are under docs/scanners/rust/. Production rust-analyzer integration, OS/ABI matrix, published package, diagnostic visibility and automatic protocol joining remain explicit release gates.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built and verified a self-contained Rust source scanner through the existing optional plugin contract. Mixed Rust/TypeScript maps preserve curated multi-file ownership, prose, authored HTTPS relationships and atomic failure. 36 focused tests, 465 existing tests, Rust lint/format and compiled toolchain-free consumer smoke passed. Pinned ripgrep and synthetic measurements plus a 3500-word production research report document the intentionally limited semantic coverage and rust-analyzer recommendation.
<!-- SECTION:FINAL_SUMMARY:END -->
