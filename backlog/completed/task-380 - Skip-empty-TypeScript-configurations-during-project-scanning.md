---
id: TASK-380
title: Skip empty TypeScript configurations during project scanning
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 18:02'
updated_date: '2026-09-13 18:17'
labels: []
dependencies: []
references:
  - src-projects
modified_files:
  - plugins/scanners/typescript/src/projects.ts
  - test-bun/nested-scanners.test.ts
  - docs/scanners/typescript/index.md
  - plugins/scanners/typescript/package.json
  - bun.lock
type: bug
ordinal: 426000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scanning a clone fails when a nested tsconfig has no input files, such as source fixtures stored with .fixture suffixes. The TypeScript adapter currently treats diagnostic 18003 as fatal before it selects project files, stopping unrelated valid source analysis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A repository containing valid TypeScript source and a nested configuration with no matching inputs scans the valid source successfully.
- [x] #2 Other configuration errors still fail scanning, and referenced configurations and existing source ownership behavior remain intact.
- [x] #3 Document and regression-test the reproduced empty-input case, update the changed scanner package version for its next publication, and pass repository checks.
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
1. Filter only TypeScript diagnostic 18003 when reading configs. 2. Verify a valid source project alongside an empty fixture config and a genuinely invalid config. 3. Update scanner documentation and package version, then run focused checks and the complete repository check after the UI change.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced TypeScript diagnostic 18003 from the actual react-callback fixture on macOS: the config includes *.tsx while source is stored with .fixture suffixes, so it has no input files. The adapter now excludes only this diagnostic from fatal config errors; it still stores the parsed configuration and follows project references. Regression fixture contains valid referenced source beside an empty input config, then introduces an invalid target option to prove real errors still stop scanning. All seven nested-scanner tests passed. Direct read-only analysis of the isolated Groma clone completed with 278 source files and 3,584 operations. Prepared @groma/scanner-typescript 0.1.2 and matching workspace lockfile; nothing published. Full bun run check passed with TASK-381: 16 Node tests, 305 Bun tests, 6 optional native skips. Specification and quality self-review passed. Windows was not run locally; the reported failure was reproduced on macOS.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Empty TypeScript configurations no longer prevent valid source scanning. Other configuration errors still fail, and reference/ownership handling is preserved. Regression tests, read-only cloned-project analysis and full repository checks passed. Scanner 0.1.2 is prepared but not published.
<!-- SECTION:FINAL_SUMMARY:END -->
