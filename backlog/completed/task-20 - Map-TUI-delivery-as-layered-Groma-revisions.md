---
id: TASK-20
title: Define Groma planning terms
status: Done
assignee:
  - '@codex'
created_date: '2026-08-02 18:02'
updated_date: '2026-08-02 18:10'
labels: []
dependencies: []
references:
  - README.md
  - groma/plans/05-tui-viewer/README.md
modified_files:
  - README.md
type: docs
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define the terms that separate current architecture, final known desired architecture, implementation sequencing, and historical experiments so humans and agents do not confuse Groma revisions with delivery layers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The root README defines observed architecture, plan, revision, milestone, implementation layer, review checkpoint, task, and spike in project-specific language
- [x] #2 A revision is defined as the final known desired architecture for one milestone, not as an implementation step or chronology entry
- [x] #3 Revision 05 remains one complete final TUI plan and no layered TUI plan directories remain in the repository
- [x] #4 Architecture validation passes and no TUI implementation code changes are introduced
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
1. Keep Revision 05 as the single complete final TUI architecture plan.
2. Add a concise planning glossary to the root README.
3. Validate the architecture revisions and confirm the mistaken split is absent.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The initial approach incorrectly split the TUI delivery sequence into six Groma revisions. The human architect clarified that a revision is the final known desired state of a milestone. The split was rolled back; implementation layers belong in Backlog task sequencing and review gates instead.

Verification: the glossary assertion found all 8 terms and exactly one TUI plan directory, 05-tui-viewer. `bun run check` validated 6 architecture states and passed 126/126 tests. `git diff --check -- README.md` passed; the task-scoped product diff contains README.md only.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Defined the project planning glossary in README.md, including revision as the final known desired architecture for one milestone. Restored Revision 05 as the single complete TUI plan and recorded implementation layers as Backlog sequencing rather than architecture revisions. Verified with glossary assertions, architecture validation, and 126 passing tests.
<!-- SECTION:FINAL_SUMMARY:END -->
