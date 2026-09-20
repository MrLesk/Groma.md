---
id: TASK-345
title: Respect Angular project template strictness
status: Done
assignee:
  - '@codex'
created_date: '2026-09-11 07:00'
updated_date: '2026-09-11 07:14'
labels: []
dependencies: []
references:
  - scan
modified_files:
  - test-bun/angular-scanner.test.ts
  - plugins/scanners/angular/src/scan.ts
  - docs/scanners/angular/index.md
type: bug
ordinal: 391000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scan an Angular project using its declared template-checking settings instead of forcing strictTemplates. Keep the compiler template checker enabled for supported event evidence, and preserve failures when the project itself enables strict checks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A supported output binding accepted with strictTemplates false scans successfully with its concrete target.
- [x] #2 The same incompatible template binding fails when the project enables strictTemplates.
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
Add a packaged fixture regression that changes template strictness, remove the forced strictTemplates override, clarify the compiler requirement, and run Angular and repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Regression reproduced a template binding accepted with strictTemplates false being rejected by the forced override. Removed only that override; noEmit and the checker API required for evidence remain enabled.

Removed forced strictTemplates while retaining the template checker needed for event evidence. Packaged Angular regression verifies the same binding succeeds under non-strict project settings and fails under strict settings. Documentation describes project-owned strictness. Implementer simplicity, specification and quality review found no authority-backed blocking defect. These are bounded fixes and behavior-preserving refactors, with no new architecture level or stored metadata. Full repository check passed outside the sandbox: 110 Node tests and 447 Bun tests, 3 tooling-dependent skips (Maven and Go), 6 existing lint warnings. macOS ARM64 only; other supported OS/CPU targets were not executed. git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed forced strictTemplates while retaining the template checker needed for event evidence. Packaged Angular regression verifies the same binding succeeds under non-strict project settings and fails under strict settings. Documentation describes project-owned strictness. Verified by focused tests and the passing repository check on macOS ARM64.
<!-- SECTION:FINAL_SUMMARY:END -->
