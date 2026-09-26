---
id: TASK-529
title: Preserve the embedding inset in web map URLs
status: Done
assignee:
  - '@codex'
created_date: '2026-09-26 15:37'
updated_date: '2026-09-26 15:42'
labels: []
dependencies: []
references:
  - render
modified_files:
  - test-bun/web-page-inset.test.ts
  - src/viewers/web/url.ts
  - src/viewers/web/render.ts
priority: medium
type: bug
ordinal: 614000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The live map applies inset from the request URL but its first URL synchronization removes that parameter. Reloading the frame or reopening its updated link loses the embedding spacing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A map opened with a positive whole-number inset keeps it when synchronizing selection or other view state.
- [x] #2 Reloading the synchronized URL preserves the same inset; URLs without a usable inset keep their existing behavior.
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
1. Carry a valid inset in the existing ViewState URL read/write path and preserve the opening page inset in render.syncUrl, including when the embedding parent posts another view. 2. Extend the existing page-inset test with a read/write/reload round trip. Test authority: the reproduced loss of embedding spacing and TASK-478. Wrong result: a synchronized URL reloads with no inset. Current tests check only the first server-rendered body; test the synchronized URL after another view field changes and reuse existing invalid-inset cases. 3. Prove the regression before fixing, run URL/embedding checks, then bun run check. No new stored knowledge, C4 concept, dependency or public parameter is introduced.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation and self-review: readView validates the existing inset parameter and writeView serializes it. syncUrl carries the inset from the opening page, because it describes the embedding frame and must survive later posted views. The URL round-trip test failed before the fix when inset disappeared, then passed after changing theme/HUD and rendering the synchronized URL again. Invalid and absent insets remain absent. Inset, theme and embedding checks: 9 passed. Existing TASK-478 documentation already describes this parameter; no new public option or stored metadata. Only the inset line in render.ts belongs to this task; other renderer changes belong to TASK-480. No blocking specification or quality finding.

Final validation: bun run check passed (16 Node tests, 750 Bun tests, 48 skipped, zero failures); git diff --check passed. The shared checkout also contains ongoing TASK-480 changes, which were preserved. Self specification and quality reviews are complete for this fix.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Web URL state retains the opening page inset through view synchronization so reopening the URL keeps the embedding frame spacing. The read/write/reload regression failed before the fix and passes afterward; absent and invalid insets keep their behavior. All 9 focused inset, theme and embedding tests passed. Repository check passed with 16 Node tests and 750 Bun tests; 48 skipped.
<!-- SECTION:FINAL_SUMMARY:END -->
