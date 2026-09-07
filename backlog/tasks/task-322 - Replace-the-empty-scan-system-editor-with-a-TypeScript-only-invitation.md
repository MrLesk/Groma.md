---
id: TASK-322
title: Replace the empty-scan system editor with a TypeScript-only invitation
status: Done
assignee:
  - '@Alex'
created_date: '2026-09-07 17:54'
updated_date: '2026-09-07 18:00'
labels: []
dependencies: []
references:
  - viewer-semantics
  - web-shell
  - terminal-painting
  - screen
documentation:
  - docs/viewers/web/index.md
  - docs/viewers/tui/index.md
  - docs/product-model.md
modified_files:
  - src/empty-world.ts
  - src/viewers/web/chrome/empty.ts
  - src/viewers/web/render.ts
  - src/viewers/tui/organisms/empty.ts
  - src/viewers/tui/panes/view.ts
  - docs/viewers/web/index.md
  - docs/viewers/tui/index.md
  - docs/product-model.md
  - test-bun/web-first-run.test.ts
type: enhancement
ordinal: 359000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a project has no scanned components, the web map currently shows a Draft system form. Groma.md only supports TypeScript, so that editor is the wrong next step. Both viewers should invite the developer to write TypeScript instead of drafting a system by hand.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When a live current map has no components, the web page does not show the Draft system form
- [x] #2 The empty invitation says no component was found, to go build something fun, and that Groma.md only supports TypeScript projects
- [x] #3 The first component still removes the invitation without a reload
- [x] #4 The terminal empty world and plain empty output use the same invitation instead of the draft-system command
- [x] #5 Tests cover that an empty project page has no system draft form, and that the empty-to-map switch still happens
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
1. Put the shared invitation copy in empty-world.ts: no component found, go build something fun, and the TypeScript-only p.s. Drop the draft-system command from emptyWorldLines so web, TUI, and plain output stay aligned.
2. Remove the Draft system form from the web empty overlay. Keep the overlay for an empty world and the compact notice when architecture exists without components.
3. Point the TUI no-components recap at the same shared copy. Keep the existing empty-to-map paint path.
4. Update docs/viewers/web/index.md, docs/viewers/tui/index.md, and docs/product-model.md so they describe the TypeScript invitation instead of drafting a system.
5. Add a web test that an empty live page has no system draft form. Keep the TUI empty-to-map switch coverage.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Specification review: AC1–AC5 hold. The live empty page has no Draft system form; the shared invitation is No component found! / Go build something fun! / p.s. Groma.md only supports TypeScript projects; paint still hides the overlay once a component exists; TUI and plain output use emptyWorldLines without a draft-system command; tests cover the missing form and the empty-to-map switch.

Quality review: the form and its submit handler are gone; copy lives once in empty-world.ts; no new abstraction. The hidden hierarchy Add dialog is pre-existing unfinished chrome and was left alone.

Verification: bun test test-bun/web-first-run.test.ts test-bun/viewer-lifecycle.test.ts (9 pass). bun run check passed (Biome existing complexity warnings only; TypeScript clean; 345 bun tests pass). Browser on a live empty project: #empty contains 0 forms and the three invitation lines. tui-test 120x36 on the same empty project showed the centered invitation.

Non-blocking: web-shell architecture still describes a drafting invitation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the Draft system form from the empty map. When nothing is scanned, web, terminal, and plain output now say no component was found, to go build something fun, and that Groma.md only supports TypeScript projects. Verified with the empty-page test, the TUI empty-to-map test, bun run check, a live empty browser page with no #empty form, and tui-test on the empty project.
<!-- SECTION:FINAL_SUMMARY:END -->
