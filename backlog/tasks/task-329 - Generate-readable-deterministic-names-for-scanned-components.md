---
id: TASK-329
title: Generate readable deterministic names for scanned components
status: Done
assignee:
  - '@component_naming'
created_date: '2026-09-09 21:02'
updated_date: '2026-09-09 21:10'
labels:
  - scanner
dependencies: []
references:
  - scan-lifecycle
  - scan-component-naming
  - angular-scanner-build
  - go-scanner-build
  - rust-scanner-build
  - vue-scanner-build
  - react-scanner-build
  - java-scanner-build
  - angular-src-scanner-index
  - go-src-scanner-index
  - rust-src-scanner-index
  - vue-src-scanner-index
  - react-src-scanner-index
  - java-src-scanner-index
  - vue-src-scanner-project
  - rust-src-scanner-project
  - react-scanner-smoke
  - go-scanner-smoke
documentation:
  - docs/component-markdown.md
  - docs/product-model.md
modified_files:
  - src/scan-component-naming.ts
  - src/scan-reconciler.ts
  - test-bun/scan-component-naming.test.ts
  - test-bun/scanner-evidence.test.ts
  - docs/component-markdown.md
  - docs/product-model.md
  - groma/systems/groma/containers/scanner/components/scanner-build-2.md
  - groma/systems/groma/containers/scanner/components/scanner-build-3.md
  - groma/systems/groma/containers/scanner/components/scanner-build-4.md
  - groma/systems/groma/containers/scanner/components/scanner-build-5.md
  - groma/systems/groma/containers/scanner/components/scanner-build-6.md
  - groma/systems/groma/containers/scanner/components/scanner-build.md
  - groma/systems/groma/containers/scanner/components/scanner-index-2.md
  - groma/systems/groma/containers/scanner/components/scanner-index-3.md
  - groma/systems/groma/containers/scanner/components/scanner-index-4.md
  - groma/systems/groma/containers/scanner/components/scanner-index-5.md
  - groma/systems/groma/containers/scanner/components/scanner-index-6.md
  - groma/systems/groma/containers/scanner/components/scanner-index.md
  - groma/systems/groma/containers/scanner/components/scanner-project-2.md
  - groma/systems/groma/containers/scanner/components/scanner-project.md
  - groma/systems/groma/containers/scanner/components/scanner-smoke-2.md
  - groma/systems/groma/containers/scanner/components/scanner-smoke.md
  - groma/systems/groma/containers/scanner/components/angular-scanner-build.md
  - >-
    groma/systems/groma/containers/scanner/components/angular-src-scanner-index.md
  - groma/systems/groma/containers/scanner/components/go-scanner-build.md
  - groma/systems/groma/containers/scanner/components/go-scanner-smoke.md
  - groma/systems/groma/containers/scanner/components/go-src-scanner-index.md
  - groma/systems/groma/containers/scanner/components/java-scanner-build.md
  - groma/systems/groma/containers/scanner/components/java-src-scanner-index.md
  - groma/systems/groma/containers/scanner/components/react-scanner-build.md
  - groma/systems/groma/containers/scanner/components/react-scanner-smoke.md
  - groma/systems/groma/containers/scanner/components/react-src-scanner-index.md
  - groma/systems/groma/containers/scanner/components/rust-scanner-build.md
  - groma/systems/groma/containers/scanner/components/rust-src-scanner-index.md
  - >-
    groma/systems/groma/containers/scanner/components/rust-src-scanner-project.md
  - groma/systems/groma/containers/scanner/components/vue-scanner-build.md
  - groma/systems/groma/containers/scanner/components/vue-src-scanner-index.md
  - groma/systems/groma/containers/scanner/components/vue-src-scanner-project.md
  - >-
    backlog/tasks/task-326.3 -
    Guide-official-scanner-installation-and-project-readiness.md
  - >-
    backlog/tasks/task-326.5 -
    Deliver-the-official-Go-scanner-using-Go-language-tooling.md
  - >-
    backlog/tasks/task-326.9 -
    Deliver-an-Angular-scanner-with-its-own-compatible-TypeScript-tooling.md
  - >-
    backlog/tasks/task-326.10 -
    Deliver-an-official-Vue-scanner-with-compiler-backed-framework-evidence.md
  - groma/systems/groma/containers/scanner/components/scan-component-naming.md
priority: high
type: feature
ordinal: 375000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer scans source files with repeated names, Groma assigns readable component IDs and filenames from source context and the existing architecture owner. The approved example maps plugins/scanners/vue/build.ts to vue-scanner-build, with equivalent React and Java names. Compare candidates together before allocation, climb source parent context when names collide, and remove encounter-order integer suffixes. After readable context is exhausted, append a short deterministic hash of the exact repository-relative source path including extension before name normalization; exclude contents and scanner identity, lengthen colliding prefixes, and reuse the same physical source owner. Titles stay readable without hash suffixes. Preserve existing IDs on ordinary later scans. Regenerate the explicitly rejected uncurated scanner build/index/project/smoke component families in this repository and update their exact Backlog references, preserving unrelated and authored architecture. This explicit one-time prototype regeneration is not a migration or compatibility layer. Core owns naming; source context is evidence for a name, not a new C4 boundary or OKF field.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The approved Vue, React, and Java build-file examples receive vue-scanner-build, react-scanner-build, and java-scanner-build, independent of file and scanner observation order.
- [x] #2 Readable source parent context distinguishes collisions before a deterministic source-path hash is needed; exhausted-context collisions use a short hash and extend matching prefixes, never numeric allocation counters.
- [x] #3 Hash inputs exclude contents and scanner identity; titles remain readable, overlapping scanners preserve one physical owner, and existing IDs stay unchanged on ordinary rescans.
- [x] #4 Minimal independent fixtures verify naming, normalized-name collisions, ordering, ownership, and existing-ID stability without reading the live architecture tree.
- [x] #5 The rejected scanner component families are regenerated with readable IDs through Groma-owned writes; exact Backlog references remain valid and unrelated authored architecture is preserved.
- [x] #6 Focused checks, the complete repository check, cold simplicity review, implementer specification and quality reviews, and final full-context review pass; regenerated records pass repeated scan and map inspection.
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
1. Gather all unowned source candidates with their existing or inferred container before component allocation; preserve exact source owners and draft matches.
2. Allocate component names together from file role, source parent context, and owner; exhaust readable context before exact-source-path hash prefixes.
3. Add focused independent naming and reconciliation tests and document core-owned naming without new OKF or C4 concepts.
4. Run focused checks, cold simplicity review, implementer reviews, and serialized repository checks. Root owns scoped live regeneration, references, and map acceptance.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented batch component naming with stem, owner, recursive source parent context, and SHA-256 path prefixes. Exact file ownership is collected across scanners before IDs are allocated; pending owners preserve existing container inference. Existing records and draft matches retain identity. Focused naming, evidence, refresh, and composition suites pass: 23 tests, 129 assertions. Targeted Biome reports no warnings; TypeScript passes. Updated the two expected filenames in the existing collision ownership test to reflect simultaneous qualification. Ready for cold simplicity review and root-owned scoped regeneration; no complete suite has run yet.

Cold simplicity review passed with no findings. Scoped regeneration used GromaFileSystem.removeSource for 16 audited empty generated records and current-source scans to replace them. First scan created exactly 16 replacement records and left all 131 other architecture files byte-identical. Two further scans created 0 records and left all 147 architecture files byte-identical. Exact references in TASK-326.3, TASK-326.5, TASK-326.9 and TASK-326.10 were remapped through Backlog CLI. Manifest and before/after proof: /var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/groma-task329-regeneration-7e6dua9s/.

Implementer specification review: AC1-4 are supported by 23 focused passing tests, including approved build names under reversed observation order, recursive context, exact-path normalization/hash collisions, 8-to-9 digit prefix expansion, shared physical ownership, existing-ID preservation, and draft status. AC5 is supported by the root regeneration manifest: 16 scoped replacements, 131 unrelated files unchanged, remapped exact refs, and two zero-creation rescans with all 147 files unchanged. AC6 remains pending complete check, full-context review, and map acceptance. OKF/C4 meaning remains in existing title, groma.id, parent, and code fields; source directories only qualify names. Quality review found no blocking defect or unnecessary new abstraction in the supported flow; the reconciler collects ownership, allocates names once, then writes through existing writers. Changed source/test files remain below 500 lines, targeted lint is clean, and fixture tests are independent and concurrent. Contradictory scanner container placement precedence is not defined by this task and remains an unimplemented non-blocking follow-up; no supporting regression was reproduced.

Complete repository check passed: bun run check, 110 Node tests and 408 Bun tests passed, 7 tool-dependent skips, 0 failures. Biome reported the same six existing warnings; no new warning. Live browser acceptance at http://127.0.0.1:48330/?component=vue-scanner-build&tab=how showed Vue scanner build on the map with exact source plugins/scanners/vue/build.ts; its Tasks tab showed the remapped TASK-326.10 link and TASK-329. All numbered IDs in the rejected families are gone and no Backlog reference points to a removed ID.

Final full-context complexity review passed with no blocking findings or material recommendations. Reviewer independently confirmed the 16 replacements changed only IDs and titles, other architecture files remain byte-identical, and historical task changes are limited to reference remapping. Coordinator accepted the supported map and scan result under delegated review authority.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
New scanned components receive readable names allocated across the full batch, qualified by owner and source context, with exact-path hash prefixes only after readable context is exhausted. Existing IDs and physical ownership remain stable. Regenerated the 16 rejected scanner records and updated four Backlog reference lists. Verified with 23 focused tests, the complete repository check (110 Node + 408 Bun passed, 7 skips), cold and contextual reviews, two byte-identical repeat scans, and live map/source/task-link inspection.
<!-- SECTION:FINAL_SUMMARY:END -->
