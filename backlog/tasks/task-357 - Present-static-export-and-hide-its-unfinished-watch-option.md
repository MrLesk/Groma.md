---
id: TASK-357
title: Present static export and hide its unfinished watch option
status: Done
assignee:
  - '@codex'
created_date: '2026-09-12 14:34'
updated_date: '2026-09-13 14:15'
labels: []
dependencies: []
references:
  - commands
  - welcome
  - export
modified_files:
  - src/cli.ts
  - src/welcome/model.ts
  - README.md
  - docs/viewers/web/index.md
  - docs/product-model.md
  - docs/viewers/creating-a-plugin.md
  - features/export.feature
  - groma/systems/groma/containers/web-viewer/components/export.md
type: enhancement
ordinal: 403000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Continuous export is confusing as a public feature because export produces files rather than serving a live application. Present export as a static snapshot operation everywhere users discover commands. Keep the unfinished watch invocation recognized only to return Coming soon, without writing output or starting subscriptions. Internal export implementation and historical Backlog records need not be removed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Export help, welcome helpers, public documentation and current feature descriptions advertise only static export and do not reveal the watch option.
- [x] #2 Invoking groma export --watch, with or without an output directory, prints Coming soon and exits before exporting or starting watchers.
- [x] #3 Normal static export still writes its snapshot and exits; existing scan and live-viewer watching remain unchanged. Repository checks and focused CLI checks pass.
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
Use a hidden Commander option with an early coming-soon response, keep the public export action one-shot, and remove continuous-export copy from current docs/helpers/features. Verify hidden help and suggestions, no-output invocation, and normal static export on a disposable fixture; run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a hidden Commander option with an early exit, before required-directory validation or export startup. The public export action now always takes one snapshot. Updated README, viewer/product/plugin docs, welcome helper, and export feature description. Verified actual export help, unknown-option suggestions, and plain welcome output. Disposable CLI checks passed for watch with no directory and both argument orders: Coming soon, exit 0, no output created. Static export produced index.html, render.js, snapshot.js, and version.js and exited. Scan help still exposes its supported watch option. An initial check assumed help export existed; this CLI does not support that form, so verification used export --help. bun run check passed (256 Bun tests, 6 skips, plus Node suite and lint/type checks). Own specification and quality review found no blocking issue; existing internal export implementation and historical records are outside this change.

All-changes review correction: updated the Export component overview through groma edit so the current architecture description also advertises static export only.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Public export documentation and helpers now describe static snapshots only. The hidden watch invocation returns Coming soon without exporting. Verified CLI discovery, no-output behavior, static assets, and the full repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
