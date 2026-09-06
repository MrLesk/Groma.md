---
id: TASK-48
title: Validate architecture only through fixtures
status: Done
assignee:
  - '@scan'
created_date: '2026-08-16 17:10'
updated_date: '2026-08-16 17:12'
labels: []
dependencies: []
references:
  - test/validate-architecture.test.ts
  - scripts/validate-architecture.ts
documentation:
  - CONTRIBUTING.md
priority: high
type: chore
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Architecture validation tests use only checked-in fixtures. They never copy or assert the live groma/ tree. The leftover validate-architecture .mjs test is deleted. bun run check no longer validates the repository architecture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No .mjs test files remain in the project source
- [x] #2 Architecture validation tests copy and assert only test/fixtures, never groma/observed
- [x] #3 bun run check does not validate the live groma architecture
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
1. Add a small validate fixture under test/fixtures/validate.
2. Point validate-architecture.test.ts at that fixture for happy-path and mutation cases. Delete test/validate-architecture.test.mjs.
3. Remove validate:architecture from bun run check. Keep the script for optional manual use.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Deleted test/validate-architecture.test.mjs. Validator tests now copy test/fixtures/validate only: one happy path covers person/system/container/component plus a relationship; two failures cover unknown parent and broken relationship. bun run check is typecheck + tests. bun run check green (48 node, 34 bun).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the leftover .mjs validator test. Architecture validation uses a shop fixture only and no longer runs against live groma/ in bun run check. Verified with the three fixture tests and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
