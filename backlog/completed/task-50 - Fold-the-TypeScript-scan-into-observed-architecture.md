---
id: TASK-50
title: Fold the TypeScript scan into observed architecture
status: Done
assignee:
  - '@scan'
created_date: '2026-08-16 17:35'
updated_date: '2026-08-16 17:40'
labels: []
dependencies:
  - TASK-40
references:
  - src/typescript-scanner.ts
  - src/core.ts
  - docs/scanners/typescript/contract.md
documentation:
  - docs/scanners/typescript/index.md
priority: high
type: feature
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone runs `groma scan`, the TypeScript plugin's C4 candidates fold through core into observed Markdown. Existing boxes keep their IDs. Authored relationship tables stay. Projection and Scene use World layout so the viewers sit with Scanner and use Core.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `groma scan` prints ok plus created/refreshed/matched counts and folds TypeScript candidates into observed Markdown.
- [x] #2 The five Groma sibling containers stay. The scanner Server candidate matches Web viewer by code file, not a new container.
- [x] #3 Projection and Scene use World layout. Core does not use Terminal viewer or Web viewer.
- [x] #4 A later scan refreshes only code and leaves relationship tables alone.
- [x] #5 The TypeScript plugin still does not import core or read groma Markdown.
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
1. Flip World layout → Projection/Scene to Projection/Scene → World layout.
2. Match existing code by scanner+file so a changed first-export symbol does not create a twin.
3. Put server.ts code on Web viewer so the Server candidate refreshes that box.
4. scanTypeScriptSource returns observation candidates. Do not fold relationships.
5. Point the live CLI scan test at a fixture so it does not rewrite this repo.
6. Update contract/docs and tests. Run groma scan. Confirm layout and counts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Flipped Projection/Scene → World layout. scanTypeScriptSource now returns observation candidates. Core matches code by file when the first-export symbol changed, and indexes created parents so a first scan can nest. Web viewer has server.ts so Server refreshes that box.

First live scan: created 1 (relationship-text), refreshed 19. No sixth container. Second scan: created 0, refreshed 20; relationship tables unchanged.

Layout x: Cli 112; Web viewer, Terminal viewer, Scanner ~221; Core 330.

Simplicity: observe → candidates → fold. Relationships stay authored. File match is the only extra core rule, required so scanner-plugin/projection/scene do not twin.

Verified: bun src/cli.ts scan; node --import=tsx --test test/*.test.ts 53/53; bun test test-bun 35/35; tsc --noEmit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma scan now folds the TypeScript C4 candidates. Existing five containers stay (Server matches Web viewer by file). Projection and Scene use World layout, so the viewers sit with Scanner and use Core. Verified with two live scans, 53 node tests, 35 bun tests, and tsc.
<!-- SECTION:FINAL_SUMMARY:END -->
