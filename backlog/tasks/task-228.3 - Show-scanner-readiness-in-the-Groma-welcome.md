---
id: TASK-228.3
title: Show scanner readiness in the Groma welcome
status: Done
assignee:
  - '@codex'
created_date: '2026-08-31 18:09'
updated_date: '2026-09-01 17:19'
labels: []
dependencies:
  - TASK-227
  - TASK-228.2
references:
  - welcome
  - scanner-modules
modified_files:
  - src/welcome/model.ts
  - src/welcome/view.ts
  - src/welcome.ts
  - src/cli.ts
  - test-bun/welcome.test.ts
  - test/instructions.test.ts
  - docs/scanners/index.md
  - groma/observed/systems/groma/containers/cli/components/welcome.md
parent_task_id: TASK-228
priority: high
type: enhancement
ordinal: 247000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer launches bare Groma. The welcome keeps the project context compact and shows a fixed one-row plugin strip at the bottom with Backlog, the embedded TypeScript scanner, and configured scanner readiness. Scanner management remains inside Advanced commands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The bottom of the interactive welcome shows Backlog and the embedded TypeScript scanner as built-in.
- [x] #2 Enabled project scanners share the bottom strip with found or missing readiness derived from the scanner inventory without executing third-party code or performing network work.
- [x] #3 The bottom strip remains one row and does not expand or move the command table when more scanners are configured; the complete inventory remains available through scanner list in Advanced commands.
- [x] #4 Plain welcome output reports the same Backlog and scanner readiness.
- [x] #5 Scanner add, install, list, and remove remain read-only references inside Advanced commands.
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
1. Project Backlog as one built-in Welcome-only plugin item and append the shared scanner inventory without creating a general plugin runtime.
2. Remove readiness from the project context box and paint one fixed-height plugin strip directly above the navigation footer.
3. Keep the strip to one row at every width; expose the complete scanner inventory through the existing Advanced scanner list command.
4. Update plain output, focused tests, scanner documentation, and observed Welcome architecture.
5. Run focused/full checks and the required simplicity, specification, quality, and full-context complexity reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one async Welcome model load that projects only scanner id and readiness from the shared inventory. Interactive and plain rendering consume the same compact summary; scanner management remains four read-only Advanced references. Focused TypeScript, 9 Welcome tests, and 9 CLI/plain tests pass.

Manual 80x50 frame verification shows the compact built-in summary, all four scanner references inside Advanced commands, complete borders, and no scanner reference selection. The full check passed lint, TypeScript, 94/94 Node tests, and 218/219 Bun tests; the one concurrent web live-watch timeout passed 1/1 in isolation.

Cold simplicity review passed with no findings. It confirmed the smallest flow is one inventory load at the model boundary, one id/readiness projection, one shared formatter, and the existing non-selectable Advanced command projection.

Final full-check evidence: both runs passed Biome/TypeScript and all 94 Node tests. Each concurrent Bun run reached 218/219 but timed out on a different unrelated live watcher; both timed-out cases passed immediately in exact isolated reruns. All 18 task-focused tests and type checking pass.

Specification and quality reviews passed with no findings. The required full-context complexity review also recommends keeping the implementation unchanged: scanner discovery stays in the scanner domain, Welcome projects only id/readiness, one formatter serves both outputs, and Advanced rows remain non-dispatchable.

Reopened after visual review. The approved correction moves readiness from the project box to a fixed bottom strip and includes Backlog as a Welcome-only built-in item; this does not create a Backlog plugin contract.

Moved readiness into a fixed bottom launcher row. The row now starts with Backlog and TypeScript as built-in, appends configured scanner readiness, and is excluded from sheet sizing so scanner count cannot expand the command table. TypeScript, 10 Welcome tests, 9 plain/CLI tests, and a 100x30 rendered frame pass.

Full repository check passes outside the sandbox: 94 Node tests and 220 Bun tests. The same run inside the sandbox hit EMFILE in two unrelated watch tests; both exact cases pass outside the sandbox.

Cold simplicity review found one obsolete scanner-only formatter. Collapsed it into the shared plugin formatter, removing the only unnecessary presentation indirection.

Quality review found the expanded 110x45 Advanced table could push the bottom rows off-screen. Reserved the final two terminal rows for plugin status and navigation, removed unused vertical gaps, and added expanded-frame coverage.

Targeted quality re-review passed: expanded 110x45 keeps table border on row 42, plugins on row 43, and navigation on row 44. Final full check passes with 94 Node and 220 Bun tests.

Full-context complexity review passed with no findings and recommends keeping the architecture unchanged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved plugin readiness from the project context to a fixed bottom row that shows Backlog and TypeScript as built-in and appends configured scanner readiness without changing command-table size. Plain output uses the same summary, while the complete scanner inventory remains under Advanced commands. Verified with rendered 100x30 and expanded 110x45 frames, 10 Welcome tests, 9 plain/CLI tests, TypeScript, the full 94 Node and 220 Bun tests, and simplicity, specification, quality, and full-context complexity reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
