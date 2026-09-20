---
id: TASK-363
title: Scan nested projects through every official scanner
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 02:47'
updated_date: '2026-09-13 03:01'
labels:
  - scanners
dependencies: []
references:
  - TASK-356
  - TASK-362
  - scanner-scan
  - react-src-scanner-index
  - vue-src-scanner-project
  - vue-src-scanner-index
  - scan
  - angular-src-scanner-index
  - go-src-scanner-index
  - java-src-scanner-index
  - scanner-adapter
  - maven
  - adapter
  - rust-src-scanner-project
  - rust-src-scanner-index
  - typescript-scanner
  - config
  - c-scanner
documentation:
  - docs/component-markdown.md
modified_files:
  - plugins/scanners/projects.ts
  - plugins/scanners/observations.ts
  - plugins/scanners/react/src/scan.ts
  - plugins/scanners/react/src/index.ts
  - plugins/scanners/vue/src/project.ts
  - plugins/scanners/vue/src/index.ts
  - plugins/scanners/angular/src/scan.ts
  - plugins/scanners/angular/src/index.ts
  - plugins/scanners/project-scanner.ts
  - plugins/scanners/go/src/index.ts
  - plugins/scanners/java/src/index.ts
  - plugins/scanners/go/src/adapter.ts
  - plugins/scanners/java/java/md/groma/scanner/MavenModel.java
  - plugins/scanners/java/src/maven.ts
  - plugins/scanners/java/src/adapter.ts
  - plugins/scanners/rust/src/project.ts
  - plugins/scanners/rust/src/index.ts
  - plugins/scanners/typescript/src/projects.ts
  - plugins/scanners/typescript/src/source-imports.ts
  - plugins/scanners/typescript/src/source-usage.ts
  - plugins/scanners/typescript/src/source-analysis.ts
  - plugins/scanners/typescript/src/graph.ts
  - plugins/scanners/typescript/src/index.ts
  - plugins/scanners/csharp/src/config.ts
  - plugins/scanners/csharp/src/index.ts
  - test-bun/nested-scanners.test.ts
  - plugins/scanners/java/package.json
  - plugins/scanners/go/package.json
  - plugins/scanners/rust/package.json
  - plugins/scanners/csharp/package.json
  - plugins/scanners/angular/package.json
  - plugins/scanners/vue/package.json
  - plugins/scanners/react/package.json
  - plugins/scanners/typescript/package.json
  - docs/scanners/react/index.md
  - docs/scanners/vue/index.md
  - docs/scanners/angular/index.md
  - docs/scanners/typescript/index.md
  - docs/scanners/go/index.md
  - docs/scanners/java/index.md
  - docs/scanners/rust/index.md
  - docs/scanners/dotnet-csharp/index.md
  - plugins/scanners/csharp/src/adapter.ts
  - bun.lock
type: bug
ordinal: 409000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Running Groma from a repository with nested apps and libraries currently discovers their manifests but several scanners still require root manifests/configuration. Yaak v2026.7.1 (mountain-loop/yaak, d11a5c4ea38ea8458deea34f0768f42b6f3b297f), apps/yaak-client, reproduces the React failure. Alex requested fixing all affected scanners including TypeScript, Vue and Angular. Keep existing language semantics and preparation requirements. Source project boundaries remain evidence, not new C4 levels or OKF concepts. Published 0.1.0 packages are immutable; changed plugins need new versions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 From the repository root, affected official scanners select nested projects using language build declarations and existing explicit settings, without scanning workspace members twice.
- [x] #2 Framework readiness and scanning select the same projects and their compiler configurations. TypeScript uses the owning nested configuration for imports and aliases.
- [x] #3 Combined evidence retains repository-relative source, diagnostic and binding paths, distinct project identities and source ownership. A failed selected project fails the scan without partial results.
- [x] #4 Nested source and build-configuration changes refresh affected scanners through the existing shared watch runtime.
- [x] #5 Focused domain tests cover selection, composition and TypeScript configuration ownership. Record manual adapter verification and the prepared Yaak result without expanding language semantics to force success.
- [x] #6 Update docs and changed package versions, pass the repository check and required simplicity and complexity reviews.
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
Keep the public scanner contract unchanged. Add small official-plugin helpers for Git-owned declaration selection and observation composition. Framework compilers run with each selected project configuration while source evidence remains relative to the repository. Language adapters use their existing build tools to select nested units and avoid duplicating workspace members; explicit Rust/C# selection remains authoritative. TypeScript groups source analysis by compiler project and resolves used imports through the compiler. Extend configuration watch patterns, add focused domain cases, verify staged adapters including Yaak, bump changed plugins to 0.1.1, and run focused checks, cold simplicity review, own reviews, full-context complexity review and bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused tests passed: sibling React/Vue/Angular projects keep callback targets separate, peer-dependency declaration selection excludes ignored/dependency folders, and nested TypeScript aliases resolve and refresh independently. Full check passed with 16 Node and 263 Bun tests, six existing native skips, no lint warnings. Manual staged adapter checks passed: nested Go modules under go.work; nested Rust fixture; nested C# solution with two project roots emitted once; nested callforpapers Maven app (665 files). Yaak v2026.7.1 scans passed from repository root: React 245 files and 8 callbacks including packages/ui SplitLayout to apps/yaak-client HttpRequestLayout; TypeScript 681 files, 5225 operations, 13677 invocations; Rust one workspace root, 238 files, 12287 invocations. No Yaak source was changed for these checks.

Cold simplicity review passed without blockers. Applied its two simplifications: removed duplicate automatic C# input selection from the low-level adapter, and clarified selected TypeScript program-source naming while removing a redundant callback. Own specification review confirms nested selection, scoped compiler settings, path/identity composition, configuration subscriptions and package/doc changes meet the task. Own quality review found no supported-flow blocker; shared declaration inventory now excludes deleted tracked manifests, matching the existing discovery/file inventory behavior. React metadata includes the now-exercised Yaak React 19.2.8. Java POM-only aggregator model selection was checked separately. Complete final complexity review before task closure.

Final verification: combined Groma scan on Yaak succeeded. The duplicate-operation defect found in that result was corrected by retaining physical TypeScript operation IDs and all compiler invocation claims; a shared-source regression passes. The final combined scan has 4497 unique TypeScript operations. A real shared source watcher observed a temporary edit to apps/yaak-client/components/BinaryFileEditor.tsx: the three direct callback claims disappeared, the Rust observation was retained without rescan, and restoring the source restored its evidence. The source file matches Git afterward. C# simplification was rechecked on the restored nested solution (3 roots,6 files,24 calls). Cold simplicity and final full-context complexity reviews passed. Final bun run check: 16 Node and 264 Bun tests pass, six existing native skips, no lint warnings; manual native checks cover those adapters separately. All eight plugin versions and the lockfile are prepared at 0.1.1; these versions have not been published.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All eight official scanners now select nested projects from the repository root. Framework and TypeScript compiler contexts use project configuration, native tools retain build membership, and evidence keeps repository-relative paths. TypeScript shared operations are not duplicated. Verified nested framework and configuration tests, manual native adapters, combined Yaak scans and real source-watch refresh/restoration. Repository checks and both reviews pass. Plugin 0.1.1 versions are prepared for release.
<!-- SECTION:FINAL_SUMMARY:END -->
