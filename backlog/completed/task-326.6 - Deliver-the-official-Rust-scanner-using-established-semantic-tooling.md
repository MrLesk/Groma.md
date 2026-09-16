---
id: TASK-326.6
title: Deliver the official Rust scanner using established semantic tooling
status: Done
assignee:
  - '@scanner_rust'
created_date: '2026-09-08 21:34'
updated_date: '2026-09-08 22:46'
labels:
  - scanners
dependencies:
  - TASK-326.3
references:
  - 'https://github.com/MrLesk/Groma.md/tree/research/rust-scanner-prototype'
  - 'https://github.com/MrLesk/Groma.md/tree/research/rust-codex-validation'
  - scanner
documentation:
  - docs/scanners/evidence.md
  - docs/scanners/creating-a-plugin.md
  - docs/component-markdown.md
  - docs/scanners/rust/index.md
  - docs/scanners/rust/validation.md
modified_files:
  - plugins/scanners/rust/.gitignore
  - plugins/scanners/rust/native/Cargo.toml
  - plugins/scanners/rust/native/src/main.rs
  - plugins/scanners/rust/package.json
  - plugins/scanners/rust/native/src/scan.rs
  - plugins/scanners/rust/native/Cargo.lock
  - plugins/scanners/rust/src/project.ts
  - plugins/scanners/rust/src/index.ts
  - plugins/scanners/rust/build.ts
  - plugins/scanners/rust/notices.ts
  - test/fixtures/rust-semantic/Cargo.toml
  - test/fixtures/rust-semantic/src/lib.rs
  - test/fixtures/rust-semantic/src/api.rs
  - test/fixtures/rust-semantic/src/provider.rs
  - test/fixtures/rust-semantic/src/unreferenced.rs
  - test/fixtures/rust-semantic/groma/index.md
  - test/fixtures/rust-semantic/groma/project.md
  - test/fixtures/rust-collision/Cargo.toml
  - test/fixtures/rust-collision/app/Cargo.toml
  - test/fixtures/rust-collision/app/src/main.rs
  - test/fixtures/rust-collision/app/src/local.rs
  - test/fixtures/rust-collision/worker/Cargo.toml
  - test/fixtures/rust-collision/worker/src/lib.rs
  - test/fixtures/rust-shared/Cargo.toml
  - test/fixtures/rust-shared/src/lib.rs
  - test/fixtures/rust-shared/src/main.rs
  - test/fixtures/rust-shared/src/shared.rs
  - test-bun/rust-scanner.test.ts
  - plugins/scanners/rust/upstream-licenses.json
  - bun.lock
  - plugins/scanners/rust/smoke-compiled.ts
  - docs/scanners/rust/index.md
  - docs/scanners/rust/validation.md
parent_task_id: TASK-326
type: feature
ordinal: 367000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer with the project's Rust tooling installed can install the official Rust scanner and receive reliable source evidence for one supported Cargo project. Start from research/rust-scanner-prototype and research/rust-codex-validation. Reuse suitable adapter, packaging, fixtures, and validation assets. Replace the prototype's custom semantic resolution with established Rust analysis tooling rather than expanding a competing language implementation; choose the engine against the required evidence before broad implementation. A toolchain-free consumer package is not required.

The prototype has a reproduced wrong-provider case: an application depends on a crate named worker, imports a local worker module through use local::*, and calls worker::run(). Rust executes the local function, but the prototype reports the dependency function as resolved. The delivered scanner must establish the compiler-consistent target or preserve uncertainty.

The Codex research also showed that a physical file can participate in multiple compilation contexts. Keep compilation membership separate from Groma's single curated source owner; do not create C4 boxes from build targets or silently choose/merge contradictory evidence. Review one minimal shared-source example before changing the shared contract. The reduced-workspace Codex experiment is useful evidence but does not count as a successful full-workspace scan. Full Codex support is not an acceptance requirement for this delivery.

Follow the common discovery/readiness journey and state the chosen engine's tooling, project preparation, supported scope, and uncertainty limits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Useful work from both Rust research branches is reused, while semantic name/type/call resolution relies on an established Rust analysis engine rather than the prototype's custom resolver.
- [x] #2 The supported Cargo project loads with documented installed tools and project configuration, and missing prerequisites produce actionable readiness diagnostics.
- [x] #3 The wildcard-import/dependency-name collision reports the actual local target or explicit uncertainty; it never reports the dependency target as certain.
- [x] #4 One minimal shared-source example demonstrates the declared compilation-context behavior without duplicate physical-file identities, guessed targets, or invented architecture ownership; any unsupported context is explained explicitly.
- [x] #5 The plugin produces deterministic shared-contract evidence, runs in compiled Groma, and yields a human-reviewed result for one supported real project.
- [x] #6 Repeat scans preserve curated ownership and failed scans preserve the prior map; fixture tests, documented limitations, and declared-platform package checks support release qualification.
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
1. Use pinned rust-analyzer 0.0.301 Cargo loader and HIR; compiler and engine wrong-provider probes passed. 2. Preserve one source identity; omit semantic claims for multiply compiled files and report the limitation. Use existing selected-manifest scope; no SDK or architecture storage changes. 3. Reuse research adapter/package and fixture patterns; implement Cargo readiness, native evidence, deterministic fixture checks, and local compiled package. 4. Validate pinned original ripgrep 14.1.1 globset library, curated repeat scans and atomic failure; complete coordinator cold review, own specification/quality review, serialized full check, and final full-context review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified rustc and rust-analyzer ra_ap_hir 0.0.301 agree on wildcard-import collision: local worker::run returns 2. The globset package at ripgrep 14.1.1 has useful single-context canonical calls. Coordinator approved native pinned engine, original globset manifest, and one physical shared file with explicit unsupported-context diagnostics and omitted call claims. Same-package library/binary fixture exposes two HIR contexts. Cross-package path loading is unsupported by this engine version and must not become silent partial evidence.

Implemented the native rust-analyzer worker and ESM adapter, with Cargo/rustc/rust-src readiness and offline locked dependency loading. Reused the research adapter process/package shape and license-notice builder; reused the fixture curation/failure proof pattern. Focused native suite passed 6 tests and 32 assertions. Native Clippy with warnings denied, targeted Biome, and TypeScript check passed. A real npm-packed artifact ran through the current compiled Groma binary: scanner check, scan, curated repeat, and failed-scan preservation all passed on macOS arm64. Cold simplicity review requested from coordinator.

Cold simplicity review passed under coordinator review. Applied both small recommendations: removed redundant collision assertion and replaced the invocation BTreeMap with a Vec because sorted source traversal already visits each call once. Focused checks after simplification: 6 concurrent tests, 31 assertions; native Clippy -D warnings, targeted Biome, and compiled npm-package smoke passed. Implementer specification review maps AC1-4 and AC6 to these proofs; AC5 awaits coordinator real-project map acceptance. Implementer quality review found no supported-flow defect, unnecessary semantic resolver, ownership ambiguity, or missing blocking fixture. Source/tests frozen for coordinator serialized repository check and final full-context review.

Coordinator accepted the rendered pinned globset map and exact Rust source view under delegated acceptance; final full-context complexity review passed without blockers. Final observation is 4 files, 110 operations, 497 invocation records, and 123 certain records, byte-identical across two scans. The accepted Vec simplification preserves distinct chained calls sharing one source start; added one minimal regression witness and reran focused checks: 6 tests, 33 assertions passed. Documentation and artifact hashes are in docs/scanners/rust/validation.md. All acceptance criteria are supported; final repository check is being repeated by coordinator after the small test delta.

Final coherent coordinator repository check passed after the chained-call fixture delta: 110 Node tests and 396 Bun tests, 858 assertions, no failures or skipped Bun tests, with native Go/Rust prerequisites enabled. Log: /tmp/groma-task326-go-rust-final-check.log. Cold simplicity, implementer specification/quality, final full-context review, and delegated pinned-globset browser/source acceptance all passed. Technical delivery is complete; package remains private and only macOS arm64 is exercised. Public publication and additional platform qualification remain TASK-326.7.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered a pinned rust-analyzer HIR scanner with Cargo/rustc/rust-src readiness and a native packaged worker. The compiler-checked wildcard-import collision resolves to the local implementation; shared compilation source retains one physical identity and explicit uncertainty. Verified the original pinned globset package (4 files, 110 operations, 497 calls, 123 certain), deterministic scans, curated ownership, atomic failure, and compiled npm-package loading. Focused suite: 6 tests/33 assertions; full check: 110 Node + 396 Bun tests, 858 assertions. Required reviews and delegated rendered-map acceptance passed. Private macOS arm64 package; publication and other platforms are TASK-326.7.
<!-- SECTION:FINAL_SUMMARY:END -->
