---
id: TASK-347
title: Keep scanner discovery concise and honor project exclusions
status: Done
assignee:
  - '@codex'
created_date: '2026-09-11 07:04'
updated_date: '2026-09-11 07:14'
labels: []
dependencies: []
references:
  - discovery
modified_files:
  - test-bun/scanner-discovery.test.ts
  - src/scanner/modules/discovery.ts
  - docs/scanners/discovery.md
type: bug
ordinal: 393000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Technology discovery should skip paths excluded by the project scanner configuration and report unresolved versions once in their findings rather than repeating them as coverage-limit messages. Preserve meaningful unsupported-technology and parse-error limits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Configured excluded declarations do not contribute findings or recommendations, while retained declarations do.
- [x] #2 Missing versions remain visible in findings without duplicate coverage-limit entries; unsupported technologies still have coverage limits.
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
Add discovery regressions using the existing isolated fixture, apply configured exclusions to declaration paths, remove duplicate unresolved-version limits, update discovery documentation, and run focused and repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Discovery applies scanner exclusions before reading declarations and leaves unresolved versions in findings without duplicate limit messages. Eight discovery tests cover retained/excluded declarations and meaningful coverage limits. Extracted declarationFindings after lint detected excessive complexity; the new warning is resolved. Implementer simplicity, specification and quality review found no authority-backed blocking defect. These are bounded fixes and behavior-preserving refactors, with no new architecture level or stored metadata. Full repository check passed outside the sandbox: 110 Node tests and 447 Bun tests, 3 tooling-dependent skips (Maven and Go), 6 existing lint warnings. macOS ARM64 only; other supported OS/CPU targets were not executed. git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Discovery applies scanner exclusions before reading declarations and leaves unresolved versions in findings without duplicate limit messages. Eight discovery tests cover retained/excluded declarations and meaningful coverage limits. Extracted declarationFindings after lint detected excessive complexity; the new warning is resolved. Verified by focused tests and the passing repository check on macOS ARM64.
<!-- SECTION:FINAL_SUMMARY:END -->
