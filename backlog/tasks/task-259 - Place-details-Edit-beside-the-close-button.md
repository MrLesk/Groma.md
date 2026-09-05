---
id: TASK-259
title: Place details Edit beside the close button
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 17:27'
updated_date: '2026-09-05 17:30'
labels: []
dependencies: []
references:
  - web-viewer-authoring
modified_files:
  - src/viewers/web/organisms/editable.ts
ordinal: 298000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect reads element or relationship details in the live Web viewer, Edit appears at the top-right beside Close, matching the supplied annotated screenshot. Keep the existing Edit, Save and Cancel behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Edit sits beside Close at the top-right, without covering the metadata or leaving a gap above the details content.
- [x] #2 Element and relationship editing still opens the existing Save/Cancel form, and read-only views keep no Edit control.
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
1. Position the existing shared Edit control beside Close and reserve metadata space. 2. Verify both detail kinds and Cancel in the browser, run bun run check, and complete the required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The existing Edit button is positioned beside Close with the same 32px height and an 8px gap; metadata reserves room only while Edit exists. Browser verification confirms both element and relationship alignment and successful Edit/Cancel interaction without writes. The body no longer reserves the old button row. No event or capability behavior changed. Initial full check passed lint, types and 104 Node tests; 300/301 Bun tests passed with the known architecture live-reload timeout. A rerun is underway after closing the temporary fixture watcher.

Cold simplicity review passed with no findings. Implementer specification and quality review confirm this is a CSS-only placement change: the existing form lifecycle and live/read-only gating are unchanged, and the browser verified both detail kinds and Cancel. No new documentation or automated UI test is needed for this positional change.

Full-context review passed with no recommendations. Final shared-suite attempt passed lint, TypeScript, all 104 Node tests and 300/301 Bun tests; the existing background architecture watcher read a moved fixture file after removal (ENOENT). The isolated web-authoring suite immediately passed all 6 tests. Earlier runs encountered unrelated watcher timing failures. These failures are outside the two CSS declarations changed here; no watcher behavior was changed. Browser placement and form interaction checks and all relevant focused checks pass. No documentation change is required.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved the shared details Edit control beside Close with an 8px gap and matching 32px height, reserving metadata space and removing the old content gap. Verified element and relationship Edit/Cancel in the browser. Both reviews, lint, types, 104 Node tests and isolated authoring tests pass. The full Bun suite has an unrelated intermittent architecture watcher failure (300/301 passed).
<!-- SECTION:FINAL_SUMMARY:END -->
