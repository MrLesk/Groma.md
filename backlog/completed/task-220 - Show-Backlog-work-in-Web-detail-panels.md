---
id: TASK-220
title: Show Backlog work in Web detail panels
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 16:57'
updated_date: '2026-08-30 21:00'
labels: []
dependencies: []
references:
  - work-projection
  - backlog-plugin
  - work-overlay
  - web-viewer-details
  - task-diff
  - page
  - render
  - web-shell
  - work-focus
  - web-viewer-details-2
  - component-tasks
modified_files:
  - src/types.ts
  - src/work/backlog.ts
  - src/work/pins.ts
  - src/viewers/web/work/details.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/task-diff/view.ts
  - src/viewers/web/task-diff/control.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - src/viewers/web/url.ts
  - test-bun/work.test.ts
  - test-bun/work-pins.test.ts
  - test-bun/inspect-details.test.ts
  - test-bun/task-diff.test.ts
  - test-bun/web-url.test.ts
  - src/viewers/tui/work/paint.ts
  - test-bun/web-live.test.ts
  - test-bun/chrome.test.ts
  - test-bun/navigation.test.ts
  - docs/product-model.md
  - docs/viewers/web/index.md
  - src/viewers/web/server.ts
  - src/viewers/web/work/island.ts
  - test-bun/work-status-filter.test.ts
  - test-bun/viewer-lifecycle.test.ts
  - test-bun/viewer-live.test.ts
  - src/viewers/web/work/status-filter.ts
  - docs/viewers/tui/index.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/web-viewer-details-2.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/web-viewer-details.md
  - src/viewers/web/work/component-tasks.ts
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/component-tasks.md
type: feature
ordinal: 233000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers need to understand both the contract and execution state of a Backlog task, and the planned, active, and completed work that affects an architecture component. A selected task presents its contract before execution information. A selected component with linked Backlog work adds a Tasks tab using the existing detail-panel tabs. Projects and components without linked work keep the current component details unchanged. The feature is read-only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A selected task shows task ID, title, description, acceptance criteria, Definition of Done, and architecture references before modified files, implementation plan, implementation notes, and comments.
- [x] #2 Optional task-detail sections with no data are omitted while Backlog ordering and completion state are preserved.
- [x] #3 A component with at least one linked Backlog task shows a Tasks tab beside What it does and How it is built.
- [x] #4 A component without linked Backlog tasks keeps the existing two-tab detail panel, including when the project does not use Backlog.
- [x] #5 The Tasks tab groups each linked task once as To do, In progress, or Done from the configured Backlog default, intermediate, and terminal statuses.
- [x] #6 A task is linked to a component by an exact architecture reference or by a modified file mapped to that component.
- [x] #7 Each task row shows its task ID and title, and selecting it opens the existing task detail and map-highlighting flow.
- [x] #8 Completed linked tasks remain available as component history instead of expiring after a short time window.
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
1. Keep WorkSnapshot as the fast Backlog task-list projection: task identity, lifecycle, architecture references, modified files, acceptance progress, and update time; load it with one list call plus workflow configuration.
2. Add one selected-task detail read that calls Backlog task view only when a developer opens a Web task, carrying description, full acceptance criteria, Definition of Done, plan, notes, and comments.
3. Serve selected-task detail through the Web viewer and let the existing task-detail controller combine it with the independent Git task diff without changing component task grouping or map selection.
4. Keep TUI Work on the same fast task-list summary without adding a second cross-agent selection flow.
5. Fix Work island initialization so the empty cold-start snapshot cannot become an intentional empty status filter; configured default visibility must show In Progress work on first load.
6. Update focused loader, server, projection, task-detail, and cold-start filter coverage plus public Work/Web/TUI documentation.
7. Run focused checks, rendered browser QA, bun run check, and final review gates without interrupting unrelated active tasks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the shared Work contract and Web details flow. Backlog now supplies acceptance criteria, Definition of Done, plan, notes, and comments; terminal tasks remain available as history. One shared projection groups exact component work from configured statuses. Components render the existing Tasks tab only when linked work exists, and task rows reuse the existing task selection flow. Rendered browser QA on the isolated current build confirmed the ordered TASK-220 detail document, the Work projection component with In progress and Done groups, task-row navigation to ?task=TASK-220, the absence of the Tasks tab with an empty configured work source, and no browser warnings or errors. Focused domain, URL, task-diff, and details tests pass; the existing filesystem watcher timeout remains reproducible under the shared workload, and full typecheck is presently blocked by unrelated active TASK-211 welcome-test signature errors.

Cold simplicity review passed. Applied its two task-scoped reductions: the task-diff cache key now ignores detail-only fields so live detail updates repaint without reloading the file diff, and Tasks no longer pretends to be an ordinary details-section set.

Focused verification after simplicity changes: 34/35 tests passed and targeted Biome plus git diff checks passed. The remaining Backlog watcher test times out even in isolation because the host has exhausted filesystem watchers: a minimal Bun watcher produced no event and the equivalent Node watcher raised EMFILE (too many open files). This is a shared-machine resource condition, not a TASK-220 behavior failure.

Quality review corrections: modified-file projection now links every component that maps a shared source file; live work resets Tasks to What only when a selected component loses its last linked task, preserving initial async Tasks deep links; public Work and Web guides now document complete terminal history, the ordered task detail, and the conditional component Tasks tab. Focused regression suite passes 27/27 with targeted Biome and diff checks clean.

Alex accepted the two full-context architecture reductions. detailsTabAfterWork now depends only on definitive current task availability, and detailsTabs checks actual task rows so an empty group cannot expose Tasks.

Post-reduction verification: details, Work projection, URL, and isolated Git-backed task-diff tests pass; TypeScript and diff checks pass. The two task-diff cases timed out only while run concurrently with TypeScript, then passed alone in 142 ms.

Cold-start regression correction: WorkSnapshot now maps the complete `task list --json` summary directly, including references, modified files, acceptance progress, and updatedAt. `task view` runs once only for a Web task the developer opens. The Web task controller loads full Backlog details and Git diff independently, and an unconfigured boot snapshot no longer preserves an empty status selection. TUI Work remains on the fast list summary to keep this correction isolated from active TUI work.

Verification: the real updated Backlog source loaded 233 tasks in 221 ms versus the reproduced 12.28 s N+1 path; selected TASK-220 detail loaded in 175 ms; the real projection produced 119 mapped pins, including 6 In Progress pins visible by default. TypeScript passes. Focused Work, status-filter, component details, URL, and task-diff checks pass (35 checks across the focused runs). The repository check reaches tests but the shared host still fails existing filesystem-watch cases with EMFILE, and Bun cannot open a new QA server socket (EADDRINUSE even on unused ports), so fresh rendered browser QA remains blocked by that host resource condition.

Wrap-up browser QA on the current combined build selected Sheet routing, opened its Tasks tab, verified In progress and Done groups, selected TASK-223 through the existing task flow, and verified the ordered task document: contract and checklists before references, modified files and Git source, then plan and notes. The URL committed ?task=TASK-223 and the browser console stayed empty. The repository-wide bun run check now passes completely (lint with existing warnings only, TypeScript, 91 Node tests, and 195 Bun tests). Final complexity review corrections removed the silent partial-detail fallback: a failed /task.json request now paints an explicit error instead of a misleading summary. The Work painter was renamed to component-tasks.ts and curated as the single Component tasks architecture component, linked from Web viewer details and to Work projection. The targeted re-review passed both corrections with no remaining blocker.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-30 16:58
---
Business rule confirmed: omit the component Tasks tab when no linked task affects the selected component, even when Backlog is available.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made Backlog work part of the existing Web details system. Components show a Tasks tab only when exact references or mapped modified files link work to them, grouped once by configured workflow stage with complete terminal history. Selecting a row reuses normal task highlighting and URL behavior; selected tasks load the full Backlog contract on demand and combine it with an independent Git file diff. Kept cold startup on one lightweight task-list read, fixed default Work visibility, documented the read-only flow, grouped the atomic painter under Work as Component tasks, and passed browser QA, the full repository check, and final complexity review.
<!-- SECTION:FINAL_SUMMARY:END -->
