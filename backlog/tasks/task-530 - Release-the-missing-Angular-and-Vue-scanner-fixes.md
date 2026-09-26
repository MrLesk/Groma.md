---
id: TASK-530
title: Release the missing Angular and Vue scanner fixes
status: Done
assignee:
  - '@codex'
created_date: '2026-09-26 17:28'
updated_date: '2026-09-26 22:05'
labels: []
dependencies: []
references:
  - angular-src-index
  - vue-src-index
documentation:
  - docs/scanners/publishing.md
modified_files:
  - plugins/scanners/angular/package.json
  - plugins/scanners/vue/package.json
  - bun.lock
priority: high
type: bug
ordinal: 615000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma 0.6.0 was released from source containing TASK-526 and TASK-527, but both scanner manifests still named the already-published 0.2.0 packages. The release workflow reused those packages, so npm users did not receive the fixes. Prepare and validate patch packages, then publish only after the maintainer reviews the exact versions, source commit and changelog.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Angular and Vue have new patch package versions containing the committed selected-file fixes; other package versions and runtime behavior remain unchanged.
- [x] #2 Repository checks and packaged scanner validation prove the corrected callbacks remain within selected files and fresh-checkout scans work.
- [x] #3 The maintainer can review the exact package versions, source commit, validation evidence and changelog before publication.
- [x] #4 After approval, npm exposes the new packages and installed-package verification confirms the fixes; release notes accurately describe what shipped.
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
Bump only @groma/scanner-angular and @groma/scanner-vue from 0.2.0 to 0.2.1 and refresh the workspace lockfile. Keep the existing Groma 0.6.0 CLI and scanner compatibility requirements. Build the actual scanner packages, run the existing selected-file regression coverage, run the packaged fresh-checkout checks, and run bun run check. Stage a reviewable source commit and changelog. Use the existing Release workflow with publish_scanners=false for validation, then seek maintainer approval of the exact versions and source before dispatching publish_scanners=true. After approved publication, verify npm metadata and fresh installs using Groma 0.6.0, and correct the release notes to record the scanner patch publication accurately. No release automation, scanner semantics, compatibility handling or new test behavior is needed. Existing TASK-526/527 regression tests already cover the wrong result: callback facts from excluded source files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Prepared only Angular 0.2.1, Vue 0.2.1 and the two corresponding bun.lock workspace entries. Other package metadata and all runtime source are unchanged. bun run check passed: 752 Bun tests, 48 skips, no failures, plus the Node suite. Actual npm tarballs were built and relocated. Packaged fresh-checkout checks passed for both scanners with no project dependencies or language tools and unchanged project source. A comparison against npm 0.2.0 reproduced the actual failures: Angular emitted one operation for excluded emitter.ts; Vue failed with operation references unknown file: Emitter.vue. Both 0.2.1 tarballs returned zero excluded operations and preserved callbacks when the emitter was included. Own specification and quality review passed: the package manifests own release identity, the existing builders own artifacts, and the existing workflow owns publication. No architecture or runtime changes were needed. Multi-platform build-only validation and maintainer approval remain before publishing.

Released Groma 0.6.0 successfully loaded both unpacked 0.2.1 candidates and scanned their excluded-provider fixtures. Source-only callforpapers revision 55587399548fbd4e4cae8b07f6dd686a0a3c5412 also scanned with Angular 0.2.1 candidate and published Java/TypeScript 0.2.0 on macOS arm64, without project dependencies. Its scanner diagnostics describe unsupported or unresolved framework/external facts, with no scan failure. Build-only release workflow 36259327695 is validating commit a74040e0f7df7628196d2062e93264bae9c0f65b on all five supported hosts. Publication input is false. Reviewable change and proposed changelog: https://github.com/MrLesk/groma.md/pull/111.

Build-only release run 36259327695 completed successfully for reviewed commit a74040e0f7df7628196d2062e93264bae9c0f65b: validation plus darwin-arm64, linux-x64, linux-arm64, win32-x64 and win32-arm64 packaged builds and fresh-checkout checks all passed. Every publication and CLI release job was skipped. PR CI run 36259328087 also passed on Linux, macOS and Windows. All 3,142 archived acceptance-project source files remained unchanged after the manual macOS scan. PR #111 contains the exact package versions, source commit, proposed changelog and validation links for maintainer approval. Publication acceptance criterion 4 remains open; nothing was published in this correction work.

Alex explicitly approved publication in this chat: "Yeah publish them and make a release if needed". The approved scope is Angular 0.2.1 and Vue 0.2.1 from reviewed PR #111 (a74040e0f7df7628196d2062e93264bae9c0f65b). Merge the repair, run the existing scanner-only Release workflow, verify public npm artifacts with Groma 0.6.0, and update the existing v0.6.0 release notes. No new Groma CLI release is needed.

PR #111 merged as 67426806b73ff6524ce6fc097d78b980ad2f397c. Scanner-only Release run 36273949464 was dispatched from that exact main commit with publish_scanners=true. The merged tree matches reviewed a74040e0f7df7628196d2062e93264bae9c0f65b; the existing Groma CLI version and release tag are unchanged.

Publication completed successfully through Release run 36273949464: https://github.com/MrLesk/groma.md/actions/runs/36273949464. Repository checks and scanner builds/fresh-checkout tests passed on darwin-arm64, linux-x64, linux-arm64, win32-x64 and win32-arm64. npm accepted only Angular 0.2.1 and Vue 0.2.1; every unchanged package was reused, and all CLI release jobs were skipped. Both public registry records identify gitHead 67426806b73ff6524ce6fc097d78b980ad2f397c and include signed GitHub Actions provenance. npm latest now reports 0.2.1 for both scanners and 0.6.0 for groma.md. The public registry took a few minutes to expose the new versions; no retry of publication or version change was needed.

Post-publication verification on macOS arm64 downloaded each npm package through the released Groma 0.6.0 CLI into an empty home/cache, checked readiness, scanned twice, then restored the recorded exact version into a second checkout with another empty home/cache and scanned twice again. All four install/restore flows passed; architecture remained byte-identical on repeat scans and source bytes were unchanged. The selected-file regression probe used these actual npm-installed packages: Angular 0.2.0 emitted one operation from excluded emitter.ts while 0.2.1 emitted zero; Vue 0.2.0 failed on excluded Emitter.vue while 0.2.1 scanned successfully with zero excluded operations. Both 0.2.1 packages preserved included callback relationships. Earlier source-only callforpapers acceptance evidence remains recorded above; manual post-publication execution was on macOS arm64, while CI exercised all five hosts.

Updated only the Scanners section of the existing v0.6.0 release notes to describe the separately published patches and existing-project update commands: https://github.com/MrLesk/groma.md/releases/tag/v0.6.0. Readback verified the exact body, existing Highlights/Web map/Fixes sections, Full Changelog link, release tag, target commit and publication timestamp. Own final specification and quality review found all acceptance criteria satisfied without additional runtime, workflow or architecture changes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Published @groma/scanner-angular@0.2.1 and @groma/scanner-vue@0.2.1 after maintainer approval, so npm users receive the selected-file callback fixes already present in source. PR #111 is merged. Release run 36273949464 passed repository validation and package checks on all five supported hosts; actual npm packages passed fresh installation, second-checkout restore, repeat scans, source preservation and regression checks with Groma 0.6.0 on macOS arm64. The existing v0.6.0 release notes now identify the separate scanner patches and upgrade commands. No new Groma CLI release was needed.
<!-- SECTION:FINAL_SUMMARY:END -->
