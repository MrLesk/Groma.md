---
id: TASK-480.5
title: Read diffs on an opaque pane and step between changed files
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 21:25'
updated_date: '2026-09-26 15:57'
labels: []
dependencies:
  - TASK-480.4
references:
  - 'https://claude.ai/artifact/R5cB83CFiS9ZNN3qUoK2WG'
  - source-control
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/source/control.ts
  - src/viewers/web/source/view.ts
  - src/viewers/web/source/diff-view.ts
  - docs/viewers/web/index.md
parent_task_id: TASK-480
priority: high
type: feature
ordinal: 561000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The details pane is frosted glass. With a file open, the zoomed map glows through the code. Hunk headers share the Added blue, so they read as additions. Moving to the next changed file of a component needs Back and another click. Shared rules and frames: parent TASK and the design page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 While a file or diff is open the details pane is opaque paper in every theme.
- [x] #2 Hunk headers use muted ink on a neutral band, not the Added colour.
- [x] #3 When the selected component has more than one changed file, the diff toolbar shows a stepper with position and total. It opens the previous or next changed file in place, and Back still returns to the same component tab and scroll position.
- [x] #4 The shared renderer keeps serving task diffs. Task review behaviour is unchanged.
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
1. Make the existing file-open details surface opaque and diff section headers neutral through shared CSS. 2. Let the existing source controller append previous/next changed-file controls to the shared diff toolbar, preserving its single return scroll and tab. 3. Verify multiple changed files, Back and task diffs in the browser; no new automated test is needed for this UI composition because source ownership and file diffs already have domain coverage and a browser check can exercise the navigation and return state.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TypeScript and Biome pass. Browser with two changed files verified 1/2 to 2/2 navigation, endpoint button disabling, source-file URL updates and Back to Checkout on tab=how. Computed dark-reader background is rgb(17,19,21), exactly its paper token, and hunk header uses muted rgb(154,160,168). Shared diff renderer API is unchanged; full task-diff suite and all-theme verification run with parent integration.

Parent TASK-480 integration is verified: live and static delivery, all three themes, small/empty comparisons, 1000 px layout, a single-snapshot export, 400 commits, reduced motion and live owned-source refresh. Final repository check passed (752 Bun tests, 16 Node tests; 48 skips; zero failures). Cold simplicity, implementer specification/quality and final full-context complexity reviews have no blocking findings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
File readers now use opaque theme paper and neutral diff headers. Comparison readers step between changed files while preserving the existing Back context. Verified source navigation and return behavior in the browser, plus TypeScript and Biome; shared renderer API remains unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->
