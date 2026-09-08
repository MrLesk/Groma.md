---
id: TASK-326.5
title: Deliver the official Go scanner using Go language tooling
status: In Progress
assignee:
  - '@scanner_go'
created_date: '2026-09-08 21:34'
updated_date: '2026-09-08 22:45'
labels:
  - scanners
dependencies:
  - TASK-326.3
references:
  - 'https://github.com/MrLesk/Groma.md/tree/research/go-scanner-prototype'
  - scanner
  - scanner-adapter
  - scanner-index-3
  - scanner-build-3
  - scanner-smoke
documentation:
  - docs/scanners/evidence.md
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/go/index.md
modified_files:
  - plugins/scanners/go/package.json
  - plugins/scanners/go/worker/go.mod
  - plugins/scanners/go/worker/go.sum
  - plugins/scanners/go/worker/contract.go
  - plugins/scanners/go/worker/main.go
  - plugins/scanners/go/worker/evidence.go
  - plugins/scanners/go/src/index.ts
  - plugins/scanners/go/src/adapter.ts
  - plugins/scanners/go/build.ts
  - test/fixtures/go-module/go.mod
  - test/fixtures/go-module/provider/provider.go
  - test/fixtures/go-module/caller.go
  - test-bun/go-scanner.test.ts
  - plugins/scanners/go/smoke.ts
  - docs/scanners/go/index.md
  - bun.lock
  - plugins/scanners/go/.gitignore
parent_task_id: TASK-326
type: feature
ordinal: 366000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer with the project's Go tooling installed can install the official Go scanner and scan a supported Go project through Groma's common lifecycle. Start by fetching and inspecting research/go-scanner-prototype and reuse its completed scanner work, fixtures, and research examples where available; do not assume a green preparation workflow is a delivered scanner. At task creation the visible branch head was 87bcdef, containing research preparation only, while the project owner reported further work complete. Locate the completed work before starting a replacement implementation.

Use Go's established package-loading, syntax/type, and project tools for package membership, symbol identity, and call-target evidence. Keep Groma-specific extraction in the plugin; do not implement a competing Go resolver. The local Go toolchain and project dependency preparation are documented prerequisites.

Choose one supported project from the branch's research examples and one minimal independent test fixture. Implement and review that result before extending module/workspace/build-configuration coverage. Follow the parent's evidence, discovery, readiness, and architecture ownership rules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The latest completed Go research work is located and assessed, with useful code and validation reused; any genuinely missing implementation is completed under this task rather than silently assuming the prototype is finished.
- [x] #2 The supported project is loaded through established Go tooling, using its declared compilation context and dependencies, with no custom replacement for language name/type resolution.
- [x] #3 The scanner supplies deterministic shared-contract source and operation evidence with canonical targets and explicit uncertainty for unsupported dispatch.
- [ ] #4 The official plugin is discoverable for the supported project, reports actionable missing-tool/project preparation requirements, and runs in compiled Groma through the common plugin lifecycle.
- [x] #5 One supported real project produces a human-reviewed map; repeated scans preserve curated ownership and a failed scan leaves the prior architecture unchanged.
- [ ] #6 Independent fixture tests and documented language/project/tooling limits support package qualification on the declared consumer platforms.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Assess research source and reuse its compiler-backed design plus pinned Chi v5.2.1 example; complete unavailable implementation with coordinator approval.
2. Deliver a private bundled Go adapter and native go/packages + go/types worker for the root pure-Go module in the default host build context, using canonical static targets and explicit dynamic uncertainty.
3. Reuse shared readiness with installed tooling and prepared dependencies; add independent fixture, maintainer package build, and compiled mixed-language consumer proof.
4. Verify Chi at 71307f9b7e4e9527638bc951c42b782cd1560331, coordinator browser map/source review, repeat scans, curated source refresh, and failure atomicity.
5. Document the exact support boundary and local platform evidence; complete cold, own specification/quality, serialized repository, and full-context reviews. Public naming/publication and additional platform qualification remain TASK-326.7.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fetched origin/research/go-scanner-prototype on 2026-09-09: latest remote head remains 87bcdef, preparation only. Inspecting workflow artifacts and local research locations before choosing reuse or replacement.

Located Research Go Scanner Prototype task 6aa02d70-ca2c-83eb-81f6-c9dd8e4b9420. Its final report says source publication was interrupted; local results are unverified checkpoints. No attachment URL is exposed, and one browser retrieval attempt requires login. GitHub only has preparation artifact 10064444743. Reusable evidence: Go packages/types worker approach and Chi v5.2.1 example (71307f9b7e4e9527638bc951c42b782cd1560331); no retrievable implementation source. Coordinator informed before replacement.

Coordinator approved completing missing implementation on 2026-09-09: Chi v5.2.1 root module/default host build context, go/packages + go/types worker and ESM adapter; direct/import-alias/concrete calls and relevant uncertainty only. No workspace or generic/build-variant expansion. Verified task-local Go1.27.1 darwin-arm64 archive SHA256 ee215d57e0ec269c60cc9ceca68e6bda321ba9ee5afe24f4b0988703c2d87d12.

Focused fixture tests pass (3 tests, 16 assertions) with GROMA_TEST_GO=/private/tmp/groma-task326-go-tools/go/bin/go; native tests are opt-in for language qualification. Scoped Biome and TypeScript checks pass. Packaged source-free relocated Go plugin passes compiled Groma /tmp/groma-task3263-proof/groma: discovery/configuration, readiness, mixed Go/TypeScript map, curated repeat scans, source refresh and failed-scan atomicity. Chi host context produces 35 active files, 240 operations, 559 invocations (205 concrete, 354 unresolved). Historical 36-file checkpoint included inactive build variants; current approved context is active only. Chi map exported to /private/tmp/groma-task326-go-map; reviewed mux.go and annotated HTTP request dispatch through Groma CLI.

Chi real-project preservation check passed: two repeat scans identical, temporary added declaration retained mux ownership and authored responsibility, compilation failure left previous architecture bytes unchanged, restoring source restored the prior architecture snapshot. Evidence: /private/tmp/groma-task326-go-chi-validation.json. Coordinator browser accepted current export: system and both inferred package containers load, HTTP request dispatch retains authored description, HOW IT IS BUILT opens exact mux.go/source. This accepts the evidence scaffold, not complete runtime-routing inference.

Live map now exposes exact owners for newly added TypeScript plugin files: scanner-adapter, scanner-index-3, scanner-build-3, scanner-smoke. Added these references after they became available; scanner container reference already tracked implementation changes.

Coordinator granted exclusive bun.lock refresh lease for stable private Go and Rust workspace manifests. Refreshed once with bun install --lockfile-only --ignore-scripts; coordinator will assign Rust-only lock entries to TASK-326.6 at commit.

Cold simplicity review passed without blockers. Applied two approved mechanical simplifications: collect known package IDs during the existing loop; rename compiler-position lookup to operationByFunctionPosition. No new behavior or extra review scope.

Implementer specification review: AC1 is supported by recorded remote/artifact/task recovery checks and authorized missing-source completion; AC2 by Chi go/packages loading in its go.mod context; AC3 by compiler-backed fixture with canonical aliases, methods, wrappers, closures, UTF-16 positions and explicit uncertainty; AC4 local discovery/setup/install/compiled lifecycle passes, while actual public official-package availability remains TASK-326.7; AC5 by coordinator browser/source acceptance and Chi repeat/edit/failure byte snapshots; AC6 by 3 independent fixture tests/18 assertions and declared macOS-arm64 support/qualification limits. Implementer quality review found no reproducible defect or unnecessary domain abstraction in the supported path. Cold simplifications reran fixture, packaged compiled smoke, scoped Biome, TypeScript, and diff checks successfully. No acceptance checkbox or Done status claims public release; serialized full repository check and final full-context review remain.

Final technical acceptance: full-context complexity review passed without blockers; coordinator browser/source-map acceptance passed. Serialized bun run check passed with native Go/Rust and Maven tests enabled: Node 110 passed, 0 failed, 0 skipped; Bun 396 passed, 0 failed, 0 skipped. Exact log: /tmp/groma-task326-go-rust-check.log (Go cases at lines 643–645). This includes the 3 Go fixture/readiness tests. Packaged compiled smoke and real Chi repeat/edit/failure evidence remain recorded above. AC1, AC2, AC3, AC5 and DoD2–4 are now objectively satisfied. AC4 remains open for actual official package publication/catalog discoverability despite successful local compiled lifecycle/readiness; AC6 remains open for the final declared consumer-platform qualification beyond the verified macOS arm64 build. TASK-326.7 owns those release gates. DoD1 remains open until all acceptance criteria have their final release evidence; status remains In Progress. No source edits were made during this finalization.

Corrected packaging hygiene before technical commit: earlier handoff incorrectly said dist artifacts were ignored. Added plugin-local plugins/scanners/go/.gitignore containing only dist/, matching adjacent scanners; retained all built artifacts. No source or test behavior changed.

Final coherent repository verification after the Rust regression witness: /tmp/groma-task326-go-rust-final-check.log supersedes the earlier shared check log. Node: 110 passed, 0 failed, 0 skipped. Bun: 396 passed, 0 failed, 0 skipped, 858 assertions. Native Go/Rust and Maven checks were enabled. Go has no source or test delta from its accepted implementation; its only later packaging change is plugins/scanners/go/.gitignore, already in the modified-file list and verified to ignore the built worker/package. Technical commit is ready; release gates and In Progress status remain unchanged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Technical implementation accepted: private Go plugin uses go/packages and go/types, supplies canonical static operation evidence with explicit dynamic uncertainty, and runs through compiled Groma readiness and scan lifecycle. Chi v5.2.1 browser/source map and curated repeat/edit/failure preservation passed. Final full check: /tmp/groma-task326-go-rust-final-check.log (110 Node and 396 Bun tests, no failures or skips, 858 Bun assertions), with native tooling enabled. Plugin-local dist output is ignored and retained. Official publication/catalog availability and remaining declared-platform qualification are still open under TASK-326.7; TASK-326.5 remains In Progress.
<!-- SECTION:FINAL_SUMMARY:END -->
