---
id: TASK-474
title: Allow official scanners on newer Groma versions
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 20:42'
updated_date: '2026-09-20 20:47'
labels: []
dependencies: []
references:
  - package
  - modules-discovery
  - angular-src-index
  - csharp-src-index
  - go-src-index
  - java-src-index
  - javascript-src-index
  - php-src-index
  - react-src-index
  - rust-src-index
  - swift-src-index
  - typescript-src-index
  - vue-src-index
modified_files:
  - plugins/scanners/angular/package.json
  - plugins/scanners/csharp/package.json
  - plugins/scanners/go/package.json
  - plugins/scanners/java/package.json
  - plugins/scanners/javascript/package.json
  - plugins/scanners/php/package.json
  - plugins/scanners/python/package.json
  - plugins/scanners/react/package.json
  - plugins/scanners/rust/package.json
  - plugins/scanners/swift/package.json
  - plugins/scanners/typescript/package.json
  - plugins/scanners/vue/package.json
  - bun.lock
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/publishing.md
priority: high
type: bug
ordinal: 550000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Preparing Groma 0.4.0 revealed that every official scanner declares ^0.3.0, so release selection and installed-plugin checks reject the new host before loading scanner code. The approved policy is to declare the minimum Groma version a scanner needs, without rejecting later stable Groma versions merely because their version increased.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every official scanner is eligible on its minimum Groma 0.3.0, on 0.4.0, and on later stable versions; Groma versions below 0.3.0 remain rejected.
- [x] #2 Changed scanner manifests have fresh patch versions and synchronized workspace metadata so npm can publish the new requirement.
- [x] #3 Scanner authoring and release guidance explain minimum Groma requirements and when to raise them.
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
1. Keep the existing semver selection and installed-plugin checks. Official scanners declare >=0.3.0, retaining the existing minimum and allowing newer stable hosts.
2. Give the twelve changed scanners fresh patch versions, synchronize the workspace lockfile, and update the existing plugin-authoring and publishing guidance. No loader, scanner API or workflow changes.
3. Add no tests. Use the existing repository checks and a direct package-selection check for Groma 0.2.9, 0.3.0, 0.4.0 and 1.0.0. Review the final metadata diff and obtain the requested full-context complexity review.
4. Commit and push the verified implementation. Follow through with the existing scanner-only release workflow, then verify published metadata and rerun Pages once the new exact versions exist.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced the original failure: the old official manifests reject Groma 0.4.0 because ^0.3.0 excludes it. All twelve scanners now declare >=0.3.0 and have new patch versions, confirmed unused in npm before preparation.

A temporary regression test demonstrated the rejection and the corrected behavior. Alex requested no added tests, so it was removed completely. No test files differ from HEAD; existing checks and direct metadata inspection provide verification.

Verification: bun run check passed, including the existing Node and Bun suites. The run also included the temporary test before its removal. A direct package-selection check after removal confirms all twelve new versions accept Groma 0.3.0, 0.4.0 and 1.0.0 and reject 0.2.9. Frozen-lockfile installation and git diff --check pass.

Specification, quality and full-context complexity reviews found no blockers. Compatibility remains owned by scanner manifests and the existing semver selection path. No loader, scanner API, workflow topology or architecture-record changes were needed. The new documentation explains the minimum-version policy and when to raise it. Scanner publication follows the implementation commit through the existing workflow.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Official scanners now declare Groma >=0.3.0 instead of ^0.3.0, allowing newer stable hosts while retaining the minimum. Prepared twelve new patch versions, synchronized bun.lock, and updated the authoring and release guidance. The existing selector and installed-plugin checks are unchanged. Verified existing repository checks, frozen-lockfile installation and direct selection across all twelve manifests. No tests added or changed.
<!-- SECTION:FINAL_SUMMARY:END -->
