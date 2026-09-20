---
id: TASK-369
title: Report missing local scanners during bulk restore
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 09:03'
updated_date: '2026-09-13 09:06'
labels: []
dependencies: []
references:
  - scanner-modules
modified_files:
  - src/scanner/modules/inventory.ts
  - test-bun/scanner-restore.test.ts
  - docs/scanners/setup.md
type: bug
ordinal: 415000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A committed scanner selection can refer to a local directory that is absent on a colleague computer. Bulk install silently skips it and reports success, while targeted restore already explains that the directory must be restored.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bulk scanner install fails with the missing local scanner identity and directory instead of reporting success.
- [x] #2 Available local scanners need no package install, and npm package restore still works.
- [x] #3 Failure preserves scanner selections and saved architecture.
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
Resolve local selections before skipping package installation, reject missing local packages with concrete restore guidance, and verify local and npm restore behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Specification and quality review: bulk restore resolves local package availability without importing the plugin and fails with the missing selection and directory. Existing local packages return zero installations. Tests verify project selections and saved architecture stay unchanged. Compiled CLI exits 1 with the missing path and no success output. Actual React and TypeScript npm packages restore successfully into an isolated temporary cache (2 installed). Full bun run check passes: 16 Node tests and 282 Bun tests, 6 existing native-tool skips.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Specification and quality review: bulk restore resolves local package availability without importing the plugin and fails with the missing selection and directory. Existing local packages return zero installations. Tests verify project selections and saved architecture stay unchanged. Compiled CLI exits 1 with the missing path and no success output. Actual React and TypeScript npm packages restore successfully into an isolated temporary cache (2 installed). Full bun run check passes: 16 Node tests and 282 Bun tests, 6 existing native-tool skips.
<!-- SECTION:FINAL_SUMMARY:END -->
