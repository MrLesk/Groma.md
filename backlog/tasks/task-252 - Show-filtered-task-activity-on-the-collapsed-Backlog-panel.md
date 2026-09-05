---
id: TASK-252
title: Show filtered task activity on the collapsed Backlog panel
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 16:27'
updated_date: '2026-09-05 16:36'
labels: []
dependencies: []
references:
  - work-overlay
  - render
  - architecture-model
  - work-projection
  - web-shell
modified_files:
  - features/work-summary.feature
  - src/viewers/web/work/summary.ts
  - src/viewers/web/work/island.ts
  - src/viewers/web/render.ts
  - test-bun/work-summary.test.ts
  - docs/viewers/web/index.md
  - groma/systems/groma/containers/web-viewer/components/work-overlay.md
  - groma/systems/groma/containers/web-viewer/components/summary.md
  - groma/systems/groma/containers/core/components/architecture-model.md
  - groma/systems/groma/containers/view-host/components/work-projection.md
  - groma/systems/groma/containers/web-viewer/components/web-shell.md
type: enhancement
ordinal: 291000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect views the collapsed Backlog panel, its icon badge shows the number of unique mapped tasks matching the current filters. The compact pill keeps its size. Task changes pulse briefly, count changes roll with a small bounce, completion briefly flips to a checkmark, and hover exposes status counts and the latest observed change. Reuse existing work data and motion language; keep initial and unchanged snapshots quiet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Replace the dot with the unique mapped task count in enabled statuses, including zero, without widening the pill or adding labels.
- [x] #2 Task updates briefly pulse; count changes roll with a small bounce; completion briefly flips to a checkmark then restores the count. Initial and unchanged snapshots remain quiet.
- [x] #3 Hover shows status counts and the latest observed change. Existing filters, folding, pins, chips and selection still work.
- [x] #4 Reduced motion shows current information without animation; focused state tests, bun run check and browser verification pass.
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
1. Derive unique mapped task counts and changes from the existing work snapshot and current filters in the Web work domain.
2. Replace the folded dot with a stable compact badge, transient pulse/count/completion motion, and hover summary using the shared work motion language.
3. Add focused state tests and a supported scenario; update the Web guide and verify browser behavior plus bun run check.
4. Run simplicity and quality reviews, then the requested full-context review; finalize and commit/push only task files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity review passed with no blockers. Applied its optional consolidation: derive configured statuses from the existing work snapshot instead of synchronizing a second state variable. Browser harness verified 101x42 collapsed size, unique count, pulse, rolling bounce, completion flip, hover text, zero under filters, and no animation on unchanged snapshots or with reduced motion. Full check passed outside sandbox; sandbox run failed only in existing watchScan test with EMFILE.

The running architecture watcher observed the new summary source and refreshed dependency counts. Curated its empty scan record into the existing work-overlay component through groma edit --combine summary, keeping one Work responsibility. Recorded the generated source-evidence changes; unrelated instruction and README edits remain outside this task.

Final full-context complexity review recommends keeping the approach with no material changes: one small Web work module, filters owned by the island, counts keyed by task ID, and no second store or public data changes. Own specification and quality review passed. Final bun run check passed after the status-state simplification (300 Bun tests). Browser verified expanded task selection and combined status filters at desktop width, plus completion without motion and no browser warnings/errors. Tests use fixture-owned architecture only. Unrelated README.md and AGENTS.md edits are excluded.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the collapsed Backlog dot with a unique filtered task-count badge. Added brief update, count and completion feedback and hover details while keeping the pill at 101x42 pixels. Reused the existing work snapshot, filters and completion visual language; removed duplicate configured-status state. Verified focused state tests, the actual component in a browser, reduced motion, and bun run check; cold and full-context reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
