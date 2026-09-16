---
id: TASK-262
title: Hide unfinished map editing controls
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 17:42'
updated_date: '2026-09-05 17:48'
labels: []
dependencies: []
references:
  - web-viewer-authoring
  - web-viewer-details
modified_files:
  - src/viewers/web/editing/gestures.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/organisms/writes.ts
  - src/viewers/web/authoring.ts
  - docs/viewers/web/index.md
ordinal: 301000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect opens the Web map, the unfinished System, Container, Component, Group and Connect toolbar is hidden for now. The confusing Draft plan dropdown is removed from element details editing. Keep the remaining details Edit fields and Save/Cancel flow available; shared core and CLI editing operations remain unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The map editing toolbar and its feedback are not visible or available for interaction on the live map.
- [x] #2 The details Edit action remains available and Backlog remains usable.
- [x] #3 The Draft plan dropdown is absent from element editing; remaining fields still open and Cancel normally.
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
1. Hide the existing map toolbar with a local visibility change. 2. Remove the Draft dropdown and its unused data wiring from Web details, and update the relevant viewer documentation. 3. Verify toolbar absence, remaining Edit/Cancel fields and Backlog in the browser. 4. Run bun run check, complete required reviews, and commit and push only the task files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The toolbar and its child feedback are hidden with one local CSS change. Removed the Draft plan dropdown and its unused Web-only data/type wiring; shared core and CLI operations are unchanged. Browser verification shows no visible toolbar controls, no Draft field, remaining title/description/overview/technology fields, and working Edit/Cancel and Backlog toggle. Documentation now describes the available controls. Full check passed before the dropdown removal; the next run passed lint, types and 104 Node tests but hit the known unrelated Markdown live-reload timeout (300/301 Bun tests), so it is rerunning with the preview watcher closed.

Cold simplicity review passed with no findings. Implementer specification review confirms all three criteria through browser visibility and form checks. Quality review confirms the hidden controls have no reachable keyboard or pointer entry, their feedback is also hidden, remaining field construction and Save/Cancel are unchanged, and removed Draft data is Web-only. No new tests are needed for this visibility and field-removal change; existing authoring tests cover the shared write flow.

Final focused verification passed: all 9 editing/web-authoring tests and the isolated scanner watcher test. The final full-suite attempt hit the existing scanner watcher timing assertion after lint and types passed; prior final-source full attempt passed all 104 Node tests and 300/301 Bun tests with the existing live-reload timeout. These watcher failures are unrelated to the scoped UI change and no watcher behavior was changed.

Full-context complexity review passed with no material recommendations. Both required separate reviews are complete, and no scope-backed blocker remains.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Temporarily hid the map gesture toolbar and its feedback. Removed the confusing Draft plan dropdown and unused Web-only wiring from element details while preserving other fields and shared operations. Browser checks and all 9 focused editing/authoring tests pass; both reviews passed. Full-suite runs encountered existing watcher timing failures, recorded with the isolated passing scanner watcher result.
<!-- SECTION:FINAL_SUMMARY:END -->
