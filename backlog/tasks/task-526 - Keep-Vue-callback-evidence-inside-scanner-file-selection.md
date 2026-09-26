---
id: TASK-526
title: Keep Vue callback evidence inside scanner file selection
status: Done
assignee:
  - '@codex'
created_date: '2026-09-26 15:37'
updated_date: '2026-09-26 15:42'
labels: []
dependencies: []
references:
  - vue-src-index
modified_files:
  - test-bun/vue-scanner.test.ts
  - plugins/scanners/vue/src/project.ts
priority: medium
type: bug
ordinal: 611000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The 0.5 review reproduced a failed Vue scan when an imported callback provider or handler is excluded: operations still reference the omitted file. Restore configured scanner boundaries without losing evidence from selected callbacks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Excluding the imported emitter or handler in the vue-output fixture leaves a valid Vue observation with no evidence for that file.
- [x] #2 Selected callback providers and handlers still produce the existing binding evidence.
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
1. Keep VueProject.owned restricted to scanner-selected readable files, so callback providers and handlers cannot create operations outside the observation. 2. Extend Vue scanner coverage using its existing callback fixture and real scanner exclusions. Test authority: TASK-519.4 file selection contract and the approved review fix. Wrong result: excluding Emitter.vue or receiver.ts rejects the observation. Existing coverage checks excluded independent build files, not imported callbacks; one focused test will assert valid remaining evidence for each excluded endpoint. 3. Show the new test failing before the fix, run focused scanner checks, then the full repository check. This restores existing behavior; OKF records and C4 concepts are unchanged.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation and self-review: scannerFiles supplies the selected inputs; VueProject keeps that set and owned now rejects other compiler context before VueEvidence records a provider or handler. The new test failed before the fix with an unknown Emitter.vue operation and now verifies both excluded endpoints plus the surviving Host callback. Vue scanner, HTTP and lint suites: 20 passed. Existing source-selection documentation already describes the restored contract; no OKF metadata or C4 boundaries change. No blocking specification or quality finding in the changed flow.

Final validation: bun run check passed (16 Node tests, 750 Bun tests, 48 skipped, zero failures); git diff --check passed. The shared checkout also contains ongoing TASK-480 changes, which were preserved. Self specification and quality reviews are complete for this fix.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Vue callback providers and handlers now obey scanner file selection, so excluding an imported endpoint no longer invalidates the observation. The regression failed before the fix and passes afterward; 20 focused Vue tests passed. Repository check passed with 16 Node tests and 750 Bun tests; 48 skipped.
<!-- SECTION:FINAL_SUMMARY:END -->
