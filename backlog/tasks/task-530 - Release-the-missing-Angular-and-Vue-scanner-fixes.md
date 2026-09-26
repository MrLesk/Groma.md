---
id: TASK-530
title: Release the missing Angular and Vue scanner fixes
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-26 17:28'
updated_date: '2026-09-26 17:31'
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
- [ ] #2 Repository checks and packaged scanner validation prove the corrected callbacks remain within selected files and fresh-checkout scans work.
- [ ] #3 The maintainer can review the exact package versions, source commit, validation evidence and changelog before publication.
- [ ] #4 After approval, npm exposes the new packages and installed-package verification confirms the fixes; release notes accurately describe what shipped.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Bump only @groma/scanner-angular and @groma/scanner-vue from 0.2.0 to 0.2.1 and refresh the workspace lockfile. Keep the existing Groma 0.6.0 CLI and scanner compatibility requirements. Build the actual scanner packages, run the existing selected-file regression coverage, run the packaged fresh-checkout checks, and run bun run check. Stage a reviewable source commit and changelog. Use the existing Release workflow with publish_scanners=false for validation, then seek maintainer approval of the exact versions and source before dispatching publish_scanners=true. After approved publication, verify npm metadata and fresh installs using Groma 0.6.0, and correct the release notes to record the scanner patch publication accurately. No release automation, scanner semantics, compatibility handling or new test behavior is needed. Existing TASK-526/527 regression tests already cover the wrong result: callback facts from excluded source files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Prepared only Angular 0.2.1, Vue 0.2.1 and the two corresponding bun.lock workspace entries. Other package metadata and all runtime source are unchanged. bun run check passed: 752 Bun tests, 48 skips, no failures, plus the Node suite. Actual npm tarballs were built and relocated. Packaged fresh-checkout checks passed for both scanners with no project dependencies or language tools and unchanged project source. A comparison against npm 0.2.0 reproduced the actual failures: Angular emitted one operation for excluded emitter.ts; Vue failed with operation references unknown file: Emitter.vue. Both 0.2.1 tarballs returned zero excluded operations and preserved callbacks when the emitter was included. Own specification and quality review passed: the package manifests own release identity, the existing builders own artifacts, and the existing workflow owns publication. No architecture or runtime changes were needed. Multi-platform build-only validation and maintainer approval remain before publishing.
<!-- SECTION:NOTES:END -->
