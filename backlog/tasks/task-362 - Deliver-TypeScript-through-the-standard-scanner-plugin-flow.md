---
id: TASK-362
title: Deliver TypeScript through the standard scanner plugin flow
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-12 20:39'
updated_date: '2026-09-13 03:01'
labels:
  - scanners
dependencies:
  - TASK-361
references:
  - TASK-358
  - TASK-356
  - scanner-modules
  - typescript-scanner
  - scan-observation
  - read-read
documentation:
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/react/index.md
  - docs/scanners/react/validation.md
  - docs/scanners/rust/index.md
  - docs/scanners/rust/validation.md
modified_files:
  - src/scanner/registry.ts
  - src/scanner/modules/inventory.ts
  - src/scanner/modules/discovery.ts
  - src/scanner/modules/catalog.ts
  - src/scanner/modules/readiness.ts
  - scripts/build.ts
  - package.json
  - plugins/scanners/typescript/package.json
  - plugins/scanners/typescript/src/source-analysis.ts
  - plugins/scanners/typescript/src/worker.ts
  - plugins/scanners/typescript/build.ts
  - scripts/scanner-release.ts
  - src/empty-world.ts
  - test-bun/scanner-exclusions.test.ts
  - test-bun/scanner-composition.test.ts
  - bun.lock
  - packages/scanner/src/index.ts
  - plugins/scanners/typescript/src/structure.ts
  - plugins/scanners/typescript/src/index.ts
  - src/viewers/source/structure.ts
  - docs/agent-instructions/index.md
  - docs/scanners/publishing.md
  - docs/scanners/setup.md
  - docs/scanners/discovery.md
  - docs/scanners/index.md
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/release-qualification.md
  - docs/scanners/vue/validation.md
  - docs/scanners/vue/index.md
  - docs/scanners/angular/index.md
  - docs/scanners/react/index.md
  - docs/viewers/tui/index.md
  - docs/viewers/web/index.md
  - test-bun/source-relationships.test.ts
  - test-bun/architecture-findings.test.ts
  - src/welcome/model.ts
  - docs/scanners/java/validation.md
  - test-bun/scanner-recommendations.test.ts
type: feature
ordinal: 408000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After the official and third-party installation journeys are used and approved by a human, TypeScript should exercise the same plugin contract and installer as every other scanner. Its implementation already lives under plugins/scanners, but Groma still embeds and enables it specially. Remove that delivery special case so users obtain TypeScript through project setup and explicit package installation. Reuse the official release workflow and plugin-owned discovery metadata. This is a prototype replacement, not a migration or compatibility project.

Keep this work limited to scanner plugins. Project selection stays in the existing scanner configuration, downloads are shared across projects, and discovery metadata uses the contract from TASK-358. No marketplace, third-party recommendation index, global activation scope, compatibility migration, or new plugin framework is required. Follow TASK-352: use focused manual evidence for installation and release plumbing, keep automated tests on domain behavior, and run the normal repository check for code changes.

Explicit prerequisites before extraction: Alex must approve the demonstrated official and third-party installation/update experience from TASK-356, TASK-360, and TASK-361. Record that approval as a Backlog comment on this task, referencing the evidence it approves; predecessor tasks being Done is not sufficient on its own.

The combined React/Rust acceptance repository has not yet been selected. Before implementation, obtain Alex's selection and record its repository location or URL, exact revision, project preparation commands, selected scanner settings, one existing React/TypeScript evidence result to preserve, and one source edit with its expected refresh result. No agent should infer a repository from this conversation or invent a new language/framework capability to satisfy the example. Existing React and Rust validation documents describe supported semantics and preparation limits; they are references, not a substitute for selecting the combined example. Supported release targets are the explicit target list approved and recorded in TASK-356.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Groma no longer bundles or unconditionally enables the TypeScript scanner runtime, compiler, or native worker. TypeScript is an official package loaded through the same configured scanner registry as other scanners.
- [ ] #2 The shared official release workflow distributes a runnable TypeScript package for the advertised targets. Users install it through Groma without compiling its worker, and its manifest owns discovery and compatibility information.
- [x] #3 Fresh project setup detects TypeScript from plugin metadata and offers installation; users may accept or decline. Explicit add, list, readiness, restore, update, and remove work consistently for TypeScript without an embedded-scanner exception.
- [ ] #4 For the React/Rust repository explicitly selected and recorded before implementation, setup offers TypeScript, React and Rust; the approved existing evidence remains observable after extraction, and the recorded source edit refreshes it through the shared scanner adapter. Core architecture interpretation, OKF records and C4 meaning remain unchanged.
- [ ] #5 Before starting extraction, record Alex’s approval of the preceding installation/update experience and the concrete acceptance repository, preparation steps, evidence result and source-change scenario. Then verify fresh setup and exact restoration with compiled Groma. Remove obsolete embedded-TypeScript code and documentation directly; add no migration or compatibility layer.
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
Remove unconditional TypeScript registry, inventory, readiness and catalog exceptions. Package its existing scanner and native TypeScript worker through the shared host-build/assembly workflow; move compiler tooling out of core runtime dependencies and build assets. Update current docs directly. Verify the same existing TypeScript fixture evidence with compiled Groma and the staged plugin, including explicit install/list/check/restore/remove and empty registry. Reuse existing metadata-driven setup and update; verify them using disposable staged release metadata without advertising unpublished packages. Leave public target approval and human-selected combined React/Rust acceptance pending; do not invent a selected project.

Preserve the existing source-outline behavior by moving its TypeScript parser into the plugin and exposing the same file/declaration result through an optional scanner readCodeStructure hook. The viewer dispatches configured providers using existing Code references; this removes the final core compiler dependency without changing architecture semantics.

Alex delegated selection of a famous GitHub React/Rust project. Use mountain-loop/yaak release v2026.7.1, commit d11a5c4ea38ea8458deea34f0768f42b6f3b297f, cloned at /tmp/groma362-yaak. Inspect its documented preparation and select an existing React callback flow plus Rust package before the acceptance scan. Preserve its tracked source and manifests; do not add unsupported framework semantics to force the example to pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation preparation verified: TypeScript package bundles the existing SDK and native worker, and shared assembly now stages all eight scanners plus the contract. Core no longer imports TypeScript runtime or embeds/extracts its worker; compiled binary decreased from about 109 MB to 84 MB. Existing source outline parser moved into the plugin through an optional readCodeStructure contract, preserving compiled static-export outlines without core compiler imports. Packaged observations exactly matched source implementation on the existing React callback fixture; compiled add/check/scan/remove and selective source refresh preserved existing React interaction behavior. A disposable compiled binary with staged release metadata offered TypeScript; setup decline/accept, local-registry package update and second-checkout exact restoration passed without npm commands or public publication. Fresh setup revealed presence-only tsconfig clues blocked compatible same-directory compiler declarations; fixed conservatively within that directory and covered recommendation behavior with domain tests. Cold simplicity review passed; applied its one minor type-predicate simplification. Own specification and quality reviews found no implementation blocker. bun run check passed: 16 Node tests, 258 Bun tests, 6 existing skips, no lint warnings. Public target qualification and the human-selected combined React/Rust acceptance in AC2/4/5 are not claimed.

Final full-context complexity review passed without material recommendations. Implementation preparation is complete. Remaining evidence needs public release decisions and Alex selecting/approving the combined React/Rust acceptance project; these are explicitly not replaced by the existing fixture checks.

Yaak v2026.7.1 was cloned as requested, but its root package has no React dependency: the application is nested under apps/yaak-client. The current React readiness check reproduced REACT_PROJECT_REQUIRED, consistent with its documented root-project scope. No product behavior or Yaak files were changed to force support. Under Alex delegated example selection, selecting Pot (pot-app/pot-desktop, about 19,000 stars), stable tag 3.0.7, whose root package declares React 18.3.1 and whose backend is Rust. Retaining the Yaak clone at /tmp/groma362-yaak.

Pot tag 3.0.7 was also cloned, but uses JSX and has no root tsconfig.json, outside the current React TSX contract. Final selected example is Clash Verge Rev, https://github.com/clash-verge-rev/clash-verge-rev, tag v2.5.2, commit 28f2efc504059b1dc75c793618b775c8e1b2a5f1, at /tmp/groma362-clash-verge. Its root declares React 19.2.7 and TypeScript ^6.0.3, includes 119 TSX files through root tsconfig.json, and contains the Rust backend at src-tauri/Cargo.toml. Project declares Rust 1.95.0. Preparing with pnpm install --frozen-lockfile --ignore-scripts, Rust 1.95.0 plus rust-src, and cargo fetch --locked. No source or project manifest is changed to make it fit.

Alex requested fixing nested-project handling across every affected scanner, explicitly including TypeScript. TASK-363 now owns that work. Return to the original selected Yaak v2026.7.1 checkout after the fix; do not substitute a root-only application.

TASK-363 completed the original selected Yaak example from repository root using prepared plugin 0.1.1 adapters: React and TypeScript nested apps plus Cargo workspace scan together; a shared library React callback is present. Real source watcher refresh and source restoration passed, retaining the unchanged Rust observation. Prepared versions are not yet published and no human review approval is inferred.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-09-12 20:42
---
Astra reviewed this task without conversation history. Clarified the identified handoff gaps; unresolved release or example choices are explicitly recorded rather than inferred. Scope and To Do status are unchanged.
---

author: @codex
created: 2026-09-12 20:58
---
Alex subsequently instructed: Prepare everything, implement all tasks but do not do anything with npm; he is going to sleep. Proceeding with implementation preparation under that instruction. This is not a claim that he reviewed installation evidence or selected the combined React/Rust repository. The human acceptance and public release portions of AC4/5 remain pending; no substitute repository is claimed as his choice.
---

author: @codex
created: 2026-09-13 02:35
---
Alex answered the example-selection question: Can you find some famous one on github and clone it? Selected Yaak (mountain-loop/yaak, about 19,000 stars), pinned v2026.7.1 / d11a5c4ea38ea8458deea34f0768f42b6f3b297f. This is delegated project selection, not a claim that Alex has reviewed the final installation experience or rendered scan.
---
<!-- COMMENTS:END -->
