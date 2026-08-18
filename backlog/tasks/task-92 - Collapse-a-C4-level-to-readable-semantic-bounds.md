---
id: TASK-92
title: Collapse a C4 level to readable semantic bounds
status: Done
assignee:
  - grok
created_date: '2026-08-18 19:21'
updated_date: '2026-08-18 19:26'
labels: []
dependencies: []
documentation:
  - docs/viewers/index.md
modified_files:
  - src/semantic-view.ts
  - src/types.ts
  - test-bun/semantic-view.test.ts
  - docs/viewers/index.md
priority: high
type: feature
ordinal: 97000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Viewers must decide what exists at a C4 level before any city is sized. At System Context a system is a readable collapsed representation, not the union of every nested component. That representation keeps a stable anchor when the architect enters the system so people and siblings do not jump. This task delivers only the semantic view: visible items, collapsed sizes, promoted edges, and stable anchors. It does not replace ELK, rewrite a renderer, or author new architecture Markdown.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At Context, a fixture system with nested containers and components is visible with an intrinsic name-capable size, not the height of its nested stack
- [x] #2 That system’s anchor is the same at Context and after Enter to Containers
- [x] #3 Items out of the current C4 scope are absent; every in-scope item has a collapsed or leaf representation large enough for its name
- [x] #4 A relationship between nested endpoints is promoted to the visible representations at that level
- [x] #5 Fixture tests cover the collapse and stable-anchor rules; bun test of the new file passes
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
1. Add SemanticView types and semanticView(world, { level, focusId }) in src/semantic-view.ts. Visible items follow C4 scope; collapsed/leaf size is name-capable and independent of nested ELK bounds; origin is the existing world (x, y).
2. Promote each authored relationship to the visible endpoints at that level; drop self-edges; keep one edge per display pair.
3. Cover the rules with a hand-built fixture world in test-bun/semantic-view.test.ts (tall nested stack, person and cross-container relationship).
4. State the semantic-view contract in docs/viewers/index.md without changing current TUI or web paint.
5. Run bun test test-bun/semantic-view.test.ts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
semanticView(world, { level, focusId }) is the C4 filter before city geometry. Display size is name × 3 + 6 against the same kind minima as world-layout; origin is the existing world (x, y), never the ELK parent union. Entering Containers keeps Shop at (100, 0). Relationships promote to visible items; a crossing edge at Components adds the far container so both ends exist. ELK is unused. Viewers still paint the old world. bun test test-bun/semantic-view.test.ts: 4 pass. bunx tsc --noEmit clean. Simplicity: one module, no renderer hookup, no extra layout pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a semantic view that names the visible items at a C4 level, sizes them for their names, and keeps each origin when Enter changes level. A fixture shop 400 units tall collapses to the system minimum at Context; its (x, y) is unchanged at Containers; nested uses and person commands promote to the boxes on that level. Viewers do not paint this yet. Verified with bun test test-bun/semantic-view.test.ts (4 pass) and bunx tsc --noEmit.
<!-- SECTION:FINAL_SUMMARY:END -->
