---
id: TASK-348
title: Share framework scanner package build steps
status: Done
assignee:
  - '@codex'
created_date: '2026-09-11 07:05'
updated_date: '2026-09-11 07:14'
labels: []
dependencies: []
references:
  - react-scanner-build
  - angular-scanner-build
  - vue-scanner-build
modified_files:
  - plugins/scanners/framework-package.ts
  - plugins/scanners/angular/build.ts
  - plugins/scanners/react/build.ts
  - plugins/scanners/vue/build.ts
type: chore
ordinal: 394000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Keep the duplicated Angular, React and Vue package build flow in one internal helper while retaining each scanner-specific asset step. Preserve pinned compiler resolution, package metadata, module target and consumer behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All three packaged framework scanners retain their existing compiler-backed evidence and prerequisites behavior.
- [x] #2 Common bundling, TypeScript declaration copying and package metadata/documentation steps have one implementation; scanner-specific assets remain with their scanner.
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
Extract only the common steps from the three existing framework builds, retain React notices and Vue types in their build files, and verify through the existing packaged-scanner tests plus repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Angular, React and Vue share only bundling, pinned TypeScript declaration copying and package metadata/documentation steps. React notices and Vue types remain in their own build files. All 20 packaged framework tests passed. Native process runners remain separate because their lifecycle and input contracts differ. No public package contract changed. Implementer simplicity, specification and quality review found no authority-backed blocking defect. These are bounded fixes and behavior-preserving refactors, with no new architecture level or stored metadata. Full repository check passed outside the sandbox: 110 Node tests and 447 Bun tests, 3 tooling-dependent skips (Maven and Go), 6 existing lint warnings. macOS ARM64 only; other supported OS/CPU targets were not executed. git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Angular, React and Vue share only bundling, pinned TypeScript declaration copying and package metadata/documentation steps. React notices and Vue types remain in their own build files. All 20 packaged framework tests passed. Native process runners remain separate because their lifecycle and input contracts differ. No public package contract changed. Verified by focused tests and the passing repository check on macOS ARM64.
<!-- SECTION:FINAL_SUMMARY:END -->
