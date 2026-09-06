---
id: TASK-135
title: Filter Live work by configured Backlog statuses
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 13:39'
updated_date: '2026-08-23 14:14'
labels: []
dependencies: []
references:
  - backlog-plugin
  - render
  - iso-map
  - work-projection
  - terminal-host
modified_files:
  - src/types.ts
  - src/backlog-plugin.ts
  - src/work-projection.ts
  - src/work-pins.ts
  - src/viewers/web/atoms/backlog-mark.png
  - src/viewers/web/atoms/backlog-mark.ts
  - src/viewers/web/page.ts
  - src/viewers/web/organisms/pins.ts
  - src/viewers/web/organisms/work-island.ts
  - src/viewers/web/payload.ts
  - src/viewers/web/server.ts
  - src/view-host.ts
  - src/viewers/web/render.ts
  - src/viewers/web/url.ts
  - src/viewers/web/organisms/details.ts
  - test-bun/work.test.ts
  - test-bun/work-pins.test.ts
  - test-bun/viewer-lifecycle.test.ts
  - test-bun/viewer-live.test.ts
  - test-bun/web-live.test.ts
  - test-bun/web-page.test.ts
  - test-bun/web-url.test.ts
  - docs/viewers/web/index.md
  - docs/product-model.md
  - README.md
  - src/viewers/web/work-status-filter.ts
  - test-bun/work-status-filter.test.ts
  - src/viewers/web/atoms/work-badge.ts
  - src/work/backlog.ts
  - src/work/pins.ts
  - src/work/projection.ts
  - src/viewers/web/work/backlog-mark.png
  - src/viewers/web/work/backlog-mark.ts
  - src/viewers/web/work/badge.ts
  - src/viewers/web/work/status-filter.ts
  - src/viewers/web/work/pins.ts
  - src/viewers/web/work/island.ts
  - >-
    groma/observed/systems/groma/containers/view-host/components/backlog-plugin.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/work-projection.md
  - docs/viewers/creating-a-plugin.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/terminal-host.md
  - docs/scanners/typescript/expected.txt
  - src/viewers/tui/organisms/world.ts
type: feature
ordinal: 146000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Live work island should use Backlog's own visual identity and workflow statuses. Replace the pulse with the Backlog document mark, derive the filter buttons from the project's configured statuses, start the configured default and terminal statuses off with the intermediate workflow statuses on, and filter both pins and chips by those choices. Load every nonterminal task and only terminal tasks changed in the last 24 hours. A mapped task without an assignee receives a generic Backlog task pin and matching chip, so status filtering covers tasks rather than only agent-task pairs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The folded pill and open Live work label use the Backlog document mark from the supplied Backlog logo instead of the pulse icon
- [x] #2 The island shows one filter per configured Backlog status that currently has a mapped pin, in configuration order, including custom statuses; each filter controls both pins and chips in that status and appears on a live update when the first matching pin arrives
- [x] #3 On first open the configured default and terminal status filters are off and every other configured status filter is on; with the default configuration only In Progress is on
- [x] #4 Every task in a nonterminal status is available to the filters, while terminal-status tasks remain limited to those changed in the last 24 hours
- [x] #5 A task without an assignee that touches an architecture element has one generic Backlog task pin and matching chip with the existing activation, selection and detail behavior
- [x] #6 The web viewer documentation and focused tests describe and verify the status-driven Live work behavior
- [x] #7 The shared Live work backend is grouped under src/work and the web-specific mark, badge, filter policy, pins and island are grouped under src/viewers/web/work, without behavior changes
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
1. Keep the implemented WorkSnapshot, WorkPin and status-filter behavior unchanged.
2. Group the shared Live work backend under src/work: Backlog source, pin projection and TUI work projection. Keep the central architecture types in src/types.ts because they remain part of the shared world contract.
3. Group the complete browser Live work surface under src/viewers/web/work: Backlog mark asset, shared badge atom, pure status policy, pin layer and Live work island.
4. Update every import, test and documentation path, plus Groma architecture code evidence for moved backend components.
5. Rerun focused and full checks, deterministic browser QA, and the required final complexity review before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the status-driven Live work bar and the later clarification that empty statuses have no filter. The Backlog source now returns one workflow-and-items snapshot; web pins cover assigned and unassigned mapped tasks; the copied Backlog document mark replaces the pulse.

After the required full-context review, Alex approved extracting the filter policy and shared badge atom, and declined renaming existing Done terminology. `work-status-filter.ts` now owns and tests initial defaults, custom statuses, first-pin arrival, empty states and choice preservation. `work-badge.ts` owns the markup, shared CSS and fill behavior used by pins and chips. The targeted cold re-review passed with no regressions.

Verification: `bun run check` passed TypeScript, 92 Node tests and 142 Bun viewer tests (234 total); `git diff --check` passed. With Alex-approved Playwright fallback after the in-app Browser connection failed during setup, Chrome at 1280x800 verified page identity and nonblank rendering, no console warnings/errors, the embedded Backlog mark, initial In Progress-only filtering, To Do and Done filters appearing with their first live pins in configuration order, default off states for To Do and Done, preserved choices, and matching pin visibility. Screenshots were kept outside the repository.

A second deterministic browser check verified that an unassigned mapped task renders the generic Backlog badge and Unassigned tooltip, activates and selects from its pin, writes its task URL, and shows its id, title and description in details.

Alex approved grouping the full Live work domain. Shared work code now lives under `src/work/`; the mark, badge, status policy, pin layer and island now live under `src/viewers/web/work/`. Central work/world contracts remain in `src/types.ts`. Authored Groma code evidence was updated for `backlog-plugin` and `work-projection`, and no file-only architecture components were invented.

The clean-index verification copy passed TypeScript, 92 Node tests and 142 viewer tests. The unstaged shared working tree still makes the live-repository scanner test see deleted pre-move paths from Git’s unchanged index; nothing was staged because other tasks are active. This disappears when the approved rename is committed.

The required full-context architecture review approved the grouping, dependency direction and design-system fit. It found one stale WorkSource contract sentence, which was corrected. Its suggestion to restore live workflow-configuration reconciliation was not applied because Alex explicitly approved removing that behavior and runtime configuration edits are outside the acceptance criteria; task arrivals within the configured workflow remain covered.

Post-move Chrome verification at 1280x800 passed with no console errors: the initial In Progress-only filter and pin rendered, a live To Do pin added its disabled filter in configured order, the new pin stayed hidden, and the Backlog mark remained present.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the status-driven Live work bar and grouped the complete domain for safer maintenance. Shared Backlog loading, pin projection and terminal projection now live under src/work; the browser mark, badge, filter policy, pin layer and island live under src/viewers/web/work. Central world contracts remain central, authored Groma code evidence follows the moved implementations, and no file-only architecture elements were added. Verified with focused tests, a clean-index full suite of 92 Node and 142 viewer tests, diff/type checks, deterministic Chrome live-arrival checks, and the required full-context complexity review.
<!-- SECTION:FINAL_SUMMARY:END -->
