---
id: TASK-61
title: Show a person the commands of a launcher they use
status: Done
assignee: []
created_date: '2026-08-16 19:37'
updated_date: '2026-08-16 19:45'
labels: []
dependencies: []
references:
  - src/viewers/action-path.ts
  - src/viewers/tui/organisms/details.ts
documentation:
  - docs/viewers/tui/index.md
priority: high
type: feature
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone selects a person in the TUI, the details actions should be the commands of a launcher that person uses, not only the person-to-software edges. A launcher is software the person uses that starts other software the person also uses. Its outgoing relationships become the pinable actions, so a command such as scan appears even when it is authored only on the launcher. People who only use a destination keep their own outgoing edges. No new Markdown shape and no scanner change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A person who uses a launcher lists that launcher's outgoing relationships as pinable actions, including a start the person does not use directly
- [x] #2 A person who only uses a destination keeps their own outgoing relationships as actions
- [x] #3 Details outgoing rows, the action cursor, and Space pins use the same action list
- [x] #4 Tests use a fixture world, not live groma/
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
1. Expand outgoingActions for a person through launchers they use; keep exclusive outgoing for everyone else.
2. Draw those same actions as the details outgoing rows so cursor and Space stay aligned.
3. Document the person action list on the TUI page.
4. Fixture-test launcher expansion, destination-only people, and unchanged non-person outgoing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
outgoingActions expands only for people. A used element is a launcher when it has exclusive outgoing to other software the person also uses; the person then lists all of that launcher's outgoing, plus any of their own edges whose targets are not covered. Details draws that same list as outgoing rows so cursor and Space stay aligned. No Markdown or scanner change.

Fixture test-bun/action-path.test.ts: buyer (launcher) gets api-web and api-jobs; reader (destination only) keeps reader-web; api unchanged. bun test test-bun/ 41/41, tsc --noEmit green. One-off load of this repo's world: Human architect and Coding agent list Runs a scan · Scanner, Starts the terminal map · Terminal viewer, Starts the browser map · Web viewer.

Cold simplicity review: accept as-is. Specification and quality reviews: pass, no blockers. Non-blocking: leftover own uses are tested but not in TUI docs; no navigation test that Space pins an expanded id; pinning a launcher command traces from that edge so the person card dims.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A person who uses a launcher now sees that launcher's commands as TUI actions, including scan authored only on Cli. Destination-only people keep their own edges. Details, cursor, and Space share outgoingActions. Verified with fixture tests (41/41 viewer suite, typecheck) and a one-off load of this repo's world showing Runs a scan on both people.
<!-- SECTION:FINAL_SUMMARY:END -->
