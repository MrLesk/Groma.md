---
id: TASK-249
title: Polish the Web Help popup
status: Done
assignee:
  - codex
created_date: '2026-09-05 14:38'
updated_date: '2026-09-05 14:42'
labels: []
dependencies: []
references:
  - web-shell
  - page
modified_files:
  - src/viewers/web/page.ts
  - docs/viewers/web/index.md
ordinal: 288000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect opens Help in the Web header, Groma shows a compact, readable guide to the existing map, search, view and layer controls. Preserve the existing Help entry and 12px gap below the header. Replace the dense line-break paragraph with grouped action and key rows, and use the same popup surface as the other header menus. This is a presentation polish of the existing controls, with no new shortcuts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Help groups existing controls into readable action and shortcut rows, with a clear distinction between normal map gestures and layer gestures.
- [x] #2 Help uses the shared header popup surface and retains its 12px gap; text is legible over the map in Light, Dark and Blueprint.
- [x] #3 Listed keys and gestures match current behavior, including intentional search preview and cancellation.
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
1. Keep the current Help entry and behavior; present its existing controls as Map, Search, View and Layers rows with aligned key labels. Reuse the anchored popup surface and shared header spacing, removing duplicate Help surface styles. 2. Check the guide against existing gesture/keyboard handlers and document it. 3. Inspect Light, Dark and Blueprint at desktop and narrow widths, run bun run check, then review simplicity and quality and obtain the final complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced the line-break Help paragraph with Map, Search, View and In layers definition-list rows and key labels. Reused the anchored popup surface, removed duplicate Help surface/Blueprint styling, and kept an opaque theme paper background. No new shortcuts, state, modules or dependencies. Page stays at 439 lines. Browser verification confirmed 360px width, a 12px header gap, aligned shortcut boxes, and complete fit at 900x600. Light, Dark and Blueprint screenshots were inspected in /private/tmp/task249-qa. Key labels were checked against search control, keyboard shortcuts, camera keys and layer pointer handlers. Self simplicity, specification and quality reviews found no defect; the full-context reviewer recommended no changes.

Validation: lint and TypeScript checks pass; Node suite 104/104 passes. Both full bun run check attempts reached 290/291 viewer passes with one watcher timeout (first terminal watch, then Web Markdown watch). The exact final failing Web watcher test passed alone in 325ms. Logs: /private/tmp/task249-check.log and /private/tmp/task249-check-final.log. git diff --check is clean. No presentation-only automated tests were added.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Polished Help into grouped action/shortcut rows on the shared floating popup surface. Updated search guidance and separated layer gestures. Verified Light, Dark and Blueprint, desktop and 900x600 layout. Lint, types and Node tests pass; full viewer runs had an intermittent watcher timeout that passed in isolation. Complexity review found no material concerns.
<!-- SECTION:FINAL_SUMMARY:END -->
