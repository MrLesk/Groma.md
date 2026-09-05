---
id: TASK-273
title: Disable opening group editing from the Web map
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 19:33'
updated_date: '2026-09-05 19:37'
labels: []
dependencies: []
references:
  - render
  - iso-map
  - web-shell
  - iso-camera
  - web-viewer-authoring
modified_files:
  - src/viewers/web/authoring.ts
  - src/viewers/web/iso/pointer.ts
  - src/viewers/web/render.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/paint-ground.ts
  - src/viewers/web/chrome/group.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 312000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Clicking a group name or its zone must no longer open the Rename and Dissolve dialog. Keep normal map selection and group creation working while group editing is deferred.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a group label or zone opens no editing dialog and follows normal map selection.
- [x] #2 The unused group-dialog click path is removed; group creation and other edit controls keep their existing behavior.
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
Remove the group-specific click interception and now-unused dialog and hit metadata. Update the Web interaction documentation, verify a group click and existing selection in the browser, run the repository check and final complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed the group-only click interception, dialog and unused hit metadata. Normal map hit selection remains in place; group creation and other authoring paths are unchanged. Browser verification clicked the Blueprint map group label and selected Web viewer with zero open dialogs, then clicked the Shared projections zone and selected View host with zero open dialogs. The group editor is absent. Regular element Edit still opens its form and Cancel closes without writing. Own specification and quality reviews and the full-context complexity review passed. Documentation states only that group names and zones do not open editing, avoiding a broader selection claim for non-container zones. The required bun run check passed lint and TypeScript with seven existing warnings and all 105 Node tests; 304 Bun tests passed and two unrelated watcher/live-scan tests failed, as in TASK-272. Those failures are non-blocking for this click-path removal; see /private/tmp/groma273-check.log.

Failure detail correction: the two full-suite failures were the Web Markdown watcher timeout and the matched-ghost/component-move authoring test, where the architecture watcher read movable.md while the file was moving and raised ENOENT. Neither failure uses the group-name dialog path. A focused authoring rerun verifies that supported write flow separately.

Focused rerun: bun test --timeout 20000 test-bun/web-authoring.test.ts passed all three tests, including matched-ghost acceptance and moving an empty component; no code changes were made for that rerun.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Disabled group-name and zone editing on the Web map by removing the obsolete dialog and click interception. Verified real group selection without dialogs and regular element editing. Lint, types, and review passed; the full check still has the previously observed unrelated watcher test failures.
<!-- SECTION:FINAL_SUMMARY:END -->
