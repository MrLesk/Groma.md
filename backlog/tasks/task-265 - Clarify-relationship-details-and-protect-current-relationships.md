---
id: TASK-265
title: Clarify relationship details and available actions
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 17:53'
updated_date: '2026-09-05 18:04'
labels: []
dependencies: []
references:
  - web-viewer-details
  - observed-curation
  - web-viewer-authoring
modified_files:
  - src/relation.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/chrome/add.ts
  - test/relation.test.ts
  - test-bun/editing.test.ts
  - test-bun/web-authoring.test.ts
  - docs/viewers/web/index.md
  - docs/component-markdown.md
  - docs/agent-instructions/index.md
  - src/instructions.ts
  - groma/systems/groma/containers/cli/components/observed-curation.md
  - test/remove.test.ts
ordinal: 304000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect selects a relationship in the Web map, the details pane clearly labels its Source, Destination and Technology, with clickable endpoints. Current authored relationships are described as current rather than implying scanner ownership. Only draft relationships can be removed; the shared core operation enforces this rule for Web and CLI, including after a draft is accepted. The user explicitly approved protecting all current relationships, including manually authored ones.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Web relationship pane has clearly labeled Source and Destination endpoints that navigate to the correct elements, plus a labeled Technology section.
- [x] #2 Current relationships have no Remove control and cannot be removed through the shared operation or CLI; refused removal changes no architecture data.
- [x] #3 Draft relationships remain removable when no flow references them, and acceptance makes them non-removable.
- [x] #4 Browser checks, fixture-based lifecycle tests and bun run check verify the supported flow; documentation explains the removal rule.
- [x] #5 The hierarchy Add button is hidden while unfinished creation controls are unavailable.
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
1. Protect current relationship rows in the existing shared removal operation while retaining flow-reference checks. 2. Label relationship endpoints and technology using existing Web details styles; show Remove only for drafts and hide the hierarchy Add button. 3. Update fixture lifecycle tests and public authoring guidance. 4. Verify browser navigation and controls, run repository checks and required reviews, then commit and push only task changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Alex additionally requested hiding the hierarchy Add button while this task is active. This is included as a small visibility change alongside the relationship action cleanup.

Implemented lifecycle protection in the shared removeRelation operation; Web and CLI use the same refusal before writing. Existing flow-reference protection is retained. The Web pane now labels source, destination and technology, uses current wording, and offers removal only for drafts. The hierarchy Add control is hidden. Cold simplicity review passed with no findings. Implementer specification and quality review found no blocking defects: lifecycle tests cover current refusal with unchanged files, draft removal, and protection after acceptance; browser inspection confirmed both endpoint buttons select the correct element, relationship Edit/Cancel remains usable, and hierarchy collapse remains available. One old ghost-removal test setup was changed from add relation to draft relation to match the approved policy. Sandbox resource restrictions prevented server/watcher tests; the normal-access check passed lint, types, 104 Node tests and 300 of 301 Bun tests, with one existing Markdown watcher timeout being rerun separately.

Final verification: the isolated Web live/watcher file passed all 8 tests. The complete check passed lint, TypeScript, 104 Node tests and 300/301 Bun tests; the sole Markdown watcher timeout passed in that isolated rerun. No watcher implementation was changed. Browser checks passed for endpoint navigation, protected current controls, Edit/Cancel, hidden Add, and hierarchy collapse/expand. Full-context complexity review passed with no material recommendations. All changed source and test files remain below 500 lines. git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Relationship details clearly label Source, Destination and Technology. Only draft relationships can be removed through Web or CLI; current and accepted relationships are protected. The hierarchy Add button is hidden. Verified browser navigation and controls, fixture lifecycle tests, lint and types, 104 Node tests and 300/301 Bun tests; the single watcher timeout passed on isolated rerun (8/8). Both required reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
