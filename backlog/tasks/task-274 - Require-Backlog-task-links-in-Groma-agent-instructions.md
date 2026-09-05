---
id: TASK-274
title: Require Backlog task links in Groma agent instructions
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 19:41'
updated_date: '2026-09-05 19:43'
labels: []
dependencies: []
references:
  - agent-instructions
documentation:
  - docs/agent-instructions/index.md
modified_files:
  - src/agent-instructions.ts
  - docs/agent-instructions/index.md
ordinal: 313000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents working with Groma and an available Backlog.md CLI must keep Backlog task modified-file lists and exact Groma element references current as they change code. The generated agent nudge must state the requirement, and groma agent-instructions must explain the immediate update workflow and correct CLI fields. This makes task pins work without guessing task-to-architecture links.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The managed Groma nudge in agent instruction files requires Backlog modified-file and exact Groma reference tracking when the Backlog CLI is available.
- [x] #2 The detailed agent guide requires an immediate per-file update, preserves the complete modified-file list in first-change order, adds exact affected Groma element IDs, and shows the supported Backlog CLI commands.
- [x] #3 Guidance remains conditional on Backlog availability and task work, adds no automatic task creation or metadata inference, and preserves surrounding user instructions during nudge refresh.
- [x] #4 Generated nudge and served guide are verified through the existing init/instruction flow; required repository checks and reviews pass.
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
1. Add the conditional Backlog traceability requirement to the existing managed nudge. 2. Put the precise per-change workflow and CLI example in the existing agent guide. 3. Verify guide delivery and nudge creation/refresh through existing checks and isolated manual init, run bun run check, perform implementer reviews and the requested final full-context review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified the served groma agent-instructions output includes the Backlog workflow and CLI flags. A real groma init in an isolated directory refreshed a stale managed nudge while preserving the surrounding instructions. Reused existing init/refresh/idempotency tests rather than adding prose assertions. Implementer specification and quality reviews passed: two existing instruction owners changed, no runtime Backlog detection, task creation, automatic metadata guessing, or architecture schema change was added. Backlog owns the task fields; Groma consumes source ownership and exact element IDs.

Final full-context complexity review passed with no material ambiguity, unnecessary complexity, or blocking findings. Clarified that the exact-ID rule applies to architecture references; other task references remain valid. Final bun run check passed 105 Node tests and 306 Bun tests, with seven existing lint warnings outside this change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The managed Groma nudge now requires agents working on a Backlog task to record changed files and affected Groma element IDs whenever the Backlog CLI is available. The agent guide explains immediate per-file updates, full-list preservation and order, exact IDs, and the supported CLI commands. Verified actual nudge refresh with surrounding instructions preserved, served guide output, existing instruction lifecycle tests, 105 Node tests, 306 Bun tests, and the full-context review.
<!-- SECTION:FINAL_SUMMARY:END -->
