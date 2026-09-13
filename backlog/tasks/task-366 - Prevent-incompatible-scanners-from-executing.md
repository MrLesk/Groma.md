---
id: TASK-366
title: Prevent incompatible scanners from executing
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 08:58'
updated_date: '2026-09-13 09:06'
labels: []
dependencies: []
references:
  - catalog
  - discovery
  - scan-lifecycle
  - readiness
modified_files:
  - src/scanner/modules/catalog.ts
  - src/scanner/modules/discovery.ts
  - src/scanner/modules/settings.ts
  - src/scanner/registry.ts
  - src/scanner/modules/readiness.ts
  - src/scanner/session.ts
  - test-bun/scanner-compatibility.test.ts
  - docs/scanners/setup.md
  - docs/scanners/discovery.md
type: bug
ordinal: 412000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Settings marks installed scanners with incompatible Groma or technology metadata as blocked, but viewer startup still imports and runs them. Execution must honor the same compatibility decision while saved architecture stays available.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Known incompatible scanners are not imported or executed by scans or viewer watches; eligible scanners still run.
- [x] #2 Settings explain incompatibility and saved architecture stays available when no scanner can run.
- [x] #3 Regression coverage verifies shared runtime eligibility and saved-data behavior.
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
Share installed compatibility decisions between discovery, settings and registry loading; retain declaration watching and verify runtime behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused scanner checks pass: 7 tests. Reproduced Groma and technology incompatibilities with plugins that throw if imported; eligible selections run through startup and Check again, and saved architecture survives removal of the eligible selection.

Specification and quality review: the shared discovery result now owns installed compatibility; registry and preparation checks consult it before import. No new architecture concepts or stored fields. Eligible selections continue through Check again. Regression tests cover Groma and technology mismatches, initial and selective scans, and saved architecture. Compiled CLI smoke: incompatible scanner stays blocked and never writes its execution marker; plain view exits 0 and web returns 200. Full bun run check passes: lint without warnings, types, 16 Node tests and 282 Bun tests; 6 existing native-tool tests skipped.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Specification and quality review: the shared discovery result now owns installed compatibility; registry and preparation checks consult it before import. No new architecture concepts or stored fields. Eligible selections continue through Check again. Regression tests cover Groma and technology mismatches, initial and selective scans, and saved architecture. Compiled CLI smoke: incompatible scanner stays blocked and never writes its execution marker; plain view exits 0 and web returns 200. Full bun run check passes: lint without warnings, types, 16 Node tests and 282 Bun tests; 6 existing native-tool tests skipped.
<!-- SECTION:FINAL_SUMMARY:END -->
