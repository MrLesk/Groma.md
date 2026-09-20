---
id: TASK-362
title: Deliver TypeScript through the standard scanner plugin flow
status: Done
assignee:
  - '@codex'
created_date: '2026-09-12 20:39'
updated_date: '2026-09-13 16:16'
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
- [x] #2 The shared official release workflow distributes a runnable TypeScript package for the advertised targets. Users install it through Groma without compiling its worker, and its manifest owns discovery and compatibility information.
- [x] #3 Fresh project setup detects TypeScript from plugin metadata and offers installation; users may accept or decline. Explicit add, list, readiness, restore, update, and remove work consistently for TypeScript without an embedded-scanner exception.
- [x] #4 For the recorded React/Rust repository selected under Alex’s delegation, setup offers TypeScript, React and Rust; the existing evidence remains observable after extraction, and the recorded source edit refreshes it through the shared scanner adapter. Core architecture interpretation, OKF records and C4 meaning remain unchanged.
- [x] #5 Record Alex’s authorization to implement ahead of release review and his delegated selection of the combined acceptance repository, including preparation, evidence and source-change scenario. Verify fresh setup and exact restoration with compiled Groma. Remove obsolete embedded-TypeScript code and documentation directly; add no migration or compatibility layer.
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
Deliver TypeScript as a normal optional scanner package with its own compiler and prebuilt worker. Keep discovery, selection, readiness, exact restore, update and removal in the shared scanner flow. Preserve source outlines through the plugin hook and saved architecture with an empty registry. Verify the public packages on the delegated Yaak revision, the existing React callback, real source-watch refresh/restoration, and the shared second-checkout restore evidence from TASK-356.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation preparation verified: TypeScript package bundles the existing SDK and native worker, and shared assembly now stages all eight scanners plus the contract. Core no longer imports TypeScript runtime or embeds/extracts its worker; compiled binary decreased from about 109 MB to 84 MB. Existing source outline parser moved into the plugin through an optional readCodeStructure contract, preserving compiled static-export outlines without core compiler imports. Packaged observations exactly matched source implementation on the existing React callback fixture; compiled add/check/scan/remove and selective source refresh preserved existing React interaction behavior. A disposable compiled binary with staged release metadata offered TypeScript; setup decline/accept, local-registry package update and second-checkout exact restoration passed without npm commands or public publication. Fresh setup revealed presence-only tsconfig clues blocked compatible same-directory compiler declarations; fixed conservatively within that directory and covered recommendation behavior with domain tests. Cold simplicity review passed; applied its one minor type-predicate simplification. Own specification and quality reviews found no implementation blocker. bun run check passed: 16 Node tests, 258 Bun tests, 6 existing skips, no lint warnings. Public target qualification and the human-selected combined React/Rust acceptance in AC2/4/5 are not claimed.

Final full-context complexity review passed without material recommendations. Implementation preparation is complete. Remaining evidence needs public release decisions and Alex selecting/approving the combined React/Rust acceptance project; these are explicitly not replaced by the existing fixture checks.

Yaak v2026.7.1 was cloned as requested, but its root package has no React dependency: the application is nested under apps/yaak-client. The current React readiness check reproduced REACT_PROJECT_REQUIRED, consistent with its documented root-project scope. No product behavior or Yaak files were changed to force support. Under Alex delegated example selection, selecting Pot (pot-app/pot-desktop, about 19,000 stars), stable tag 3.0.7, whose root package declares React 18.3.1 and whose backend is Rust. Retaining the Yaak clone at /tmp/groma362-yaak.

Pot tag 3.0.7 was also cloned, but uses JSX and has no root tsconfig.json, outside the current React TSX contract. Final selected example is Clash Verge Rev, https://github.com/clash-verge-rev/clash-verge-rev, tag v2.5.2, commit 28f2efc504059b1dc75c793618b775c8e1b2a5f1, at /tmp/groma362-clash-verge. Its root declares React 19.2.7 and TypeScript ^6.0.3, includes 119 TSX files through root tsconfig.json, and contains the Rust backend at src-tauri/Cargo.toml. Project declares Rust 1.95.0. Preparing with pnpm install --frozen-lockfile --ignore-scripts, Rust 1.95.0 plus rust-src, and cargo fetch --locked. No source or project manifest is changed to make it fit.

Alex requested fixing nested-project handling across every affected scanner, explicitly including TypeScript. TASK-363 now owns that work. Return to the original selected Yaak v2026.7.1 checkout after the fix; do not substitute a root-only application.

TASK-363 completed the original selected Yaak example from repository root using prepared plugin 0.1.1 adapters: React and TypeScript nested apps plus Cargo workspace scan together; a shared library React callback is present. Real source watcher refresh and source restoration passed, retaining the unchanged Rust observation. Prepared versions are not yet published and no human review approval is inferred.

Final public evidence so far: Groma 0.3.0 installed from npm and matches the signed GitHub release binary. Public TypeScript 0.1.1 and Rust 0.1.1 scanned selected Yaak v2026.7.1 from repository root and produced 923 records. A separate reader checkout containing only saved Groma Markdown and no selected scanners passed empty scan (byte-identical Markdown), plain view, and the published web viewer (923 elements, no scanner entries). Terminal-style process-group shutdown closed the temporary npm wrapper and viewer. TASK-356 found and is publishing the shared framework packaging correction before final combined React acceptance.

Final public acceptance passed with npm-installed Groma 0.3.0, TypeScript/Rust 0.1.1 and React 0.1.2. Selected project remains mountain-loop/yaak v2026.7.1, revision d11a5c4ea38ea8458deea34f0768f42b6f3b297f. A Git archive was extracted into /tmp/groma-public-030/yaak; prepared node_modules from the original disposable checkout was copied with cp -cR (React 19.2.8, TypeScript 5.9.3). Ran cargo fetch --locked with Rust/Cargo 1.91.1 and its installed rust-src. No project source or compiler configuration was changed for acceptance.

Compiled init/discovery offered React, Rust and TypeScript from the repository root. Public bare-package add pinned the exact versions; check, combined scan, plain view and static export passed. The export includes source outlines for 486 components. The existing packages/ui/src/components/SplitLayout.tsx to apps/yaak-client/components/HttpRequestLayout.tsx callback remains observable. The public TypeScript observation contains 4497 unique physical operations.

A real shared source watcher observed the recorded temporary edit in apps/yaak-client/components/BinaryFileEditor.tsx: onChange={handleChange} became an inline forwarding callback. The three direct React claims became zero; the unchanged Rust observation retained object identity. Restoring the source restored all three claims. Final source bytes match the pinned Git revision. Logs: /tmp/groma-public-030/watch-public.log and yaak-public.log. This preserves the existing supplied-callback rule and C4/OKF interpretation.

Exact TypeScript restoration through compiled Groma is covered by the public second-checkout run recorded in TASK-356. Public add at 0.1.0, explicit update to 0.1.1, list and remove passed as well. A reader copy with only saved architecture and no source files or selected scanners passed empty scan, plain view and the published web viewer (923 saved elements); Markdown stayed byte-identical. Original implementation and both architectural reviews remain valid. The final package correction is recorded in TASK-356, whose full repository check passes. Specification and quality review confirm all current criteria and Definition of Done items are met. The recorded user authorization sequence supersedes the original before-extraction gate; no earlier human review is invented.
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

author: @codex
created: 2026-09-13 16:08
---
Closure scope correction: the original requirement for review before extraction was superseded by Alex’s explicit instruction to implement all tasks while he was away, recorded in comment 2. He later delegated the GitHub example selection (comment 3), approved the optional-TypeScript release notes and clean 0.3.0 release, and now requested both tasks be wrapped up. AC5 now records that actual authorization sequence without claiming a review happened before extraction. All public installation, restoration and example checks remain required.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TypeScript is delivered through the standard optional scanner package flow. Public installation, readiness, update, exact restore, removal and source outlines pass with Groma 0.3.0. The selected Yaak project scans from its root with React and Rust; its callback evidence survives extraction and refreshes through the shared watcher, preserving unchanged Rust data. Source restoration and saved-data viewing without scanners are verified.
<!-- SECTION:FINAL_SUMMARY:END -->
