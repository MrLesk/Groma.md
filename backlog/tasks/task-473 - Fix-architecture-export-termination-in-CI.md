---
id: TASK-473
title: Fix architecture export termination in CI
status: Done
assignee:
  - codex
created_date: '2026-09-20 20:01'
updated_date: '2026-09-20 20:14'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Groma.md/actions/runs/35533323757'
  - web-export
modified_files:
  - test-bun/web-export.test.ts
  - src/viewers/web/export.ts
type: bug
ordinal: 549000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Groma architecture workflow fails inside the export command with SIGTERM and exit code 143. Both the run before the Action updates and the updated run failed, while the ordinary CI checks passed. Restore the existing static publication flow and keep all published architecture, task details, diffs, and owned source content.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The architecture publishing workflow completes the existing export and Pages deployment successfully.
- [x] #2 The fix preserves the published architecture, task details and diffs, owned source inspection, and generated covers.
- [x] #3 The reproduced export failure is covered by the smallest relevant regression check and repository checks pass.
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
Keep task publication in the existing Web export owner. Read each task detail and its diff before starting the next task, replacing both unbounded Promise.all traversals with one sequential loop and preserving output arrays and order. Test authority: the reported export termination and the supported static export contract require export to complete with task details and diffs. Concrete failure: launching every Backlog task read together exhausts subprocess resources; existing export coverage uses an empty work list. Add one focused fixture-based export test that observes peak active task reads and verifies every task detail and diff entry reaches the published payload. Prove it fails before the change, passes after it, compare Linux resource use on the saved project, then run bun run check and the final review. Commit only export code, its regression test and this task; verify the final Pages workflow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The failed run and its predecessor both terminate inside export with signal 15; CI itself passes. Export does not use the recently changed live map session. The existing export starts all 172 Backlog readItem calls at once and then starts every task diff at once. A separate Linux reproduction with Bun 1.4.1 and Backlog 1.52.0 reached 3.937 GiB of its 4 GiB memory limit and 785 processes/threads before task reads completed; stopped the isolated run to release resources. This confirms an unbounded resource spike, while the GitHub log alone does not identify who sent SIGTERM. The change affects runtime scheduling only; stored OKF knowledge, C4 identities and containment, ordinary Markdown meaning, and published payload meaning remain unchanged.

The new fixture-based export regression fails before the fix with three task reads active simultaneously (expected one), after already verifying every detail and real Git diff reached the published page. Replaced both unbounded task traversals with one sequential loop. Alex explicitly approved committing the completed Backlog cleanup together with this fix; its staged scope is 66 unchanged-content moves from backlog/tasks to backlog/completed.

Focused checks pass: the export regression plus all three sharing checks (4 tests total). The sequential loop keeps detail and diff ownership in the existing export module, with no new helper, option, dependency, or payload field. Implementer review confirms task order, detail/diff association, source reads, and cover generation remain intact. The regression detects the original concurrent read burst without timing assertions and verifies real Git diff content. Full repository checks and the 172-task Linux export are running; hosted deployment remains the final validation gate.

bun run check passed: 16 Node tests and 624 Bun tests, with 36 skips and zero failures. The final full-context reviewer found no blockers and recommends keeping the sequential loop in the existing Web export domain. The published payload preserves every task detail and real diff in the focused test. The isolated Linux export has passed 99 of the original 172 tasks with one active detail read; measured peak container memory is 685277184 bytes. Hosted deployment remains unchecked until the pushed workflow finishes.

The full fixed export completed the original 172-task committed snapshot in isolated Linux in 116.26 seconds, with one active detail read. The exported page contains all 172 task details and 172 diff entries in the original task order, plus source inspection and all three covers. The saved reproduction uses the pre-cleanup architecture and Backlog records and the repository Git history; success does not depend on the user cleanup. Final hosted workflow validation follows the implementation push.

Hosted verification on implementation commit cff9ed3a passed. Architecture run 35534706780 completed build and Pages deployment in 2m52s (https://github.com/MrLesk/Groma.md/actions/runs/35534706780). CI run 35534706719 passed on all three hosts: Linux 1m50s, macOS 2m09s, Windows 2m51s (https://github.com/MrLesk/Groma.md/actions/runs/35534706719). All five updated Actions were exercised successfully. The implementation commit also contains the 66 unchanged-content Backlog moves explicitly approved by Alex.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Static export now finishes each task detail and diff before starting the next task, preventing an unbounded burst of CLI processes while keeping all published content. The regression failed before the fix and passes after it. Full checks passed (16 Node and 624 Bun tests; 36 skips). The original 172-task snapshot exported successfully in isolated Linux in 1m56s. The pushed implementation and user-approved Backlog cleanup passed all three CI jobs and deployed Pages successfully in 2m52s.
<!-- SECTION:FINAL_SUMMARY:END -->
