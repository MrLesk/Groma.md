---
id: TASK-283
title: Omit the repeated actor row from Web detail flows
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 21:04'
updated_date: '2026-09-05 21:13'
labels: []
dependencies: []
references:
  - flow-controls
  - web-viewer-details
modified_files:
  - src/viewers/web/flow/list.ts
  - src/viewers/web/organisms/details.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 322000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect opens an actor in the Web details pane, show that actor’s flows directly under the contextual flow heading. The selected actor already supplies the context, so repeating it as a collapsible row adds an unnecessary level.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Actor details show their own flows directly, without a repeated actor row or an extra disclosure step, and keep concise flow labels.
- [x] #2 Flow selection still opens the existing reader; actor grouping in the main hierarchy and other element details remains available.
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
Pass the inspected element ID into the shared flow list. Omit only the matching actor group and render its flows with the existing direct rows and concise titles. Keep other actor groups intact, update the web guide, run the repository check, and complete the requested full-context review.

Use the heading Flows from this actor in actor details; retain Flows through this kind for software details.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified the real shared flow-list and flow-reader components in a temporary browser preview: actor details showed a direct concise flow without an actor disclosure row; selecting it opened the existing reader; main hierarchy actor grouping still expanded independently. Specification and quality reviews found no task-scoped defects or unnecessary abstractions. Full repository check first hit sandbox EMFILE; unrestricted rerun reached 102 passing Node tests and 285 passing Bun tests with one architecture-watch event timeout. Concurrent TASK-284 then changed dependencies and temporarily blocked app startup with a Comark import mismatch. Its recorded modified files do not overlap this task; no coordination needed. Full-context complexity review requested.

Full Groma browser verification subsequently passed on the current shared source: Coding agent details show all six concise flows directly under the section heading; browser review opens its five-step reader; Back to Coding agent preserves flow selection and the direct list. Screenshot inspected. Full-context reviewer recommended keep, with no blocking findings or useful further simplification. Required check was rerun after shared dependency fixes: the remaining failure is the empty-project live-scan test explicitly being fixed by TASK-284 (285 Bun tests passed). Leave task In Progress until that repository gate passes; do not mark Done or commit/push yet.

Updated the actor-specific heading to Flows from this actor at Alex’s request. Software detail headings retain Flows through this kind; flow membership and interactions are unchanged.

After the actor-heading adjustment and the shared dependency fixes, bun run check passed: 102 Node tests and 286 Bun tests, with no failures. Final diff review confirms only contextual flow presentation and its guide changed; the earlier full-context review remains applicable.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Actor details show concise flows directly under Flows from this actor. The main hierarchy retains actor grouping. Verified direct flow selection and return in the browser, passed the full-context complexity review, and passed bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
