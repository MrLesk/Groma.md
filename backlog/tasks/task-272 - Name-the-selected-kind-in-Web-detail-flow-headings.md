---
id: TASK-272
title: Name the selected kind in Web detail flow headings
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 19:08'
updated_date: '2026-09-05 19:14'
labels: []
dependencies: []
references:
  - flow-controls
  - web-viewer-details
modified_files:
  - src/viewers/web/flow/list.ts
  - src/viewers/web/organisms/details.ts
type: enhancement
ordinal: 311000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the details flow heading explain its scope by saying Flows through this system, container, or component. Keep the global sidebar heading as Flows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Details headings name the selected element kind and retain that heading when folded or expanded.
- [x] #2 The sidebar heading remains Flows and the existing filtered list and selection behavior are preserved.
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
Pass a heading from element details into the existing shared flow renderer; verify all three software kinds and folding, then run the repository check and final review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Real browser verification passed for Groma (system), CLI (container), and Commands (component). The details heading retained its scoped wording after section folding and actor expansion; the sidebar stayed Flows. Selecting TypeScript scan still opened the matching reader. The implementation changes only the existing shared renderer title argument and its details call. Own specification and quality reviews and the final full-context review passed with no findings. No documentation change is needed for this label-only refinement; no content tests were added.

Validation: lint and TypeScript checks passed with seven existing lint warnings; all 105 Node tests passed on the final isolated run. Full-suite attempts were not clean: scan-watch stalled or missed its timing window, web-startup did not see live-scan components within five seconds, and viewer-live missed its Markdown update window. The isolated snapshot of committed code plus only the two heading files reproduced the live-scan and viewer-watch failures (304 Bun tests passed, two failed; /private/tmp/groma272-isolated-check-retry.log). These failures are outside the label change and are recorded as non-blocking rather than changing scanner or watcher behavior in this task. The requested heading, fold callbacks, scoped list, and selection were all verified in the real browser.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Details now label their filtered flow list Flows through this system, container, or component using the existing kind label. Sidebar wording stays Flows. Browser verification, lint, types, and final review passed. The full repository check was run but remains affected by unrelated scan/watcher timing failures, recorded in the notes.
<!-- SECTION:FINAL_SUMMARY:END -->
