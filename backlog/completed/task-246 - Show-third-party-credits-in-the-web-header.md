---
id: TASK-246
title: Show third-party credits in the web header
status: Done
assignee:
  - '@codex'
created_date: '2026-09-04 11:18'
updated_date: '2026-09-05 12:47'
labels: []
dependencies: []
references:
  - web-shell
  - page
  - render
modified_files:
  - src/viewers/web/chrome/credits.ts
  - src/viewers/web/page.ts
  - docs/viewers/web/index.md
  - groma/systems/groma/containers/web-viewer/components/web-shell.md
  - package.json
  - bun.lock
  - src/viewers/web/render.ts
type: feature
ordinal: 285000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect opens Credits from the web header, Groma shows the directly declared third-party runtime libraries and development tools without leaving or changing the current map. The list stays derived from the project package manifest and excludes local Groma workspace packages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The web header has an accessible information control that opens and closes a Credits popup without changing map, selection, flow, task, camera, or URL state.
- [x] #2 The popup lists every non-workspace package declared in root dependencies under Runtime libraries.
- [x] #3 The popup lists every non-workspace package declared in root devDependencies under Development tools.
- [x] #4 Each credit shows the package name, declared version, license, and project link.
- [x] #5 The popup uses the existing Web chrome and anchored-popover visual language in every viewer theme and remains usable when its list exceeds the available height.
- [x] #6 The top of the popup links to the Groma repository at https://github.com/MrLesk/Groma.md.
- [x] #7 Every non-workspace root dependency and development dependency uses an exact version without a range prefix.
- [x] #8 Clicking outside the open Credits control closes it without changing viewer state.
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
1. Add one Web chrome credits module that derives runtime and development entries from the root package manifest, excludes workspace dependencies, and reads license and project metadata from each installed package.
2. Render the credits as an icon-only native details control using the shared anchored-popover surface, with one compact row per package and bounded scrolling.
3. After TASK-245 stabilizes the shared header, integrate the control into page.ts without touching theme state, URL state, or map orchestration.
4. Update the Web viewer contract and fold the new chrome file into the existing web-shell architecture component through Groma.
5. Run focused type and rendered browser checks, then the full repository check and the required simplicity, specification, quality, and full-context complexity reviews.

6. Add the Groma repository as the first Credits entry and repeat focused rendered and repository checks.

7. Pin every non-workspace root dependency and development dependency to its currently installed exact version, refresh the lockfile, and verify the complete gate.

8. Bind Credits to the established pointerdown light-dismiss pattern and verify inside clicks stay open while outside clicks close it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented manifest-derived Credits in the Web header as part of web-shell. The native details control lists 12 runtime libraries and 4 development tools, excluding workspace dependencies, with escaped name, declared version, installed license, and project link. Cold simplicity review removed unused public model exports and found no other in-scope simplification. Playwright at 1440x900 verified open/close behavior, unchanged URL and details state, 16 complete rows, bounded scrolling, and visible content in Auto/Light, Dark, and Blueprint; screenshots are /tmp/groma-credits-open.png and /tmp/groma-credits-blueprint.png. Direct rendered-model verification found runtime=12, development=4, missing=[], links=16, metadataRows=16. bun run typecheck and bun run check passed; the full gate reported 104 Node tests and 273 Bun tests passing, with 13 existing non-blocking complexity warnings.

Final refinements: added the Groma repository as the first Credits link; pinned all 16 non-workspace root dependency declarations to exact installed versions and refreshed bun.lock; and added click-outside dismissal in the browser bootstrap. The first dismissal attempt imported the server-only Credits metadata module into render.ts and stopped the browser bundle; rendered QA exposed it immediately. Replaced that cross-boundary import with the five-line established pointerdown pattern in render.ts. Playwright at 1440x900 verified the repository link position and exact URL, inside-click retention, outside-click dismissal, unchanged URL/details state, three SVG surfaces, and no console or page errors. Screenshot: /tmp/groma-credits-repository.png. Exact-version verification reported 16 entries with ranged=[]; rendered metadata reported 17 non-empty HTTP links with the repository before Runtime libraries. Final cold simplicity review removed unsupported optional-group, github:, and git:// metadata fallbacks; focused checks passed. Final bun run check passed outside the sandbox with 104 Node tests and 283 Bun tests; the prior sandbox EMFILE watcher failure and one loaded-suite web-live timeout both passed in isolation before the clean full rerun. Nine existing complexity warnings remain outside this task.

Final full-context complexity review found no material or optional recommendations. It confirmed that server-only metadata rendering in credits.ts, the five-line browser dismissal in render.ts, and web-shell ownership are the simplest solid boundaries and prevent duplicate inventories or unsafe server/browser imports.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the Web header Credits popup with the Groma repository first, followed by 12 runtime libraries and 4 development tools derived from package.json with licenses and project links. Pinned all 16 non-workspace direct dependency declarations to exact installed versions and refreshed bun.lock. Added click-outside dismissal without changing map, details, camera, or URL state. Playwright at 1440x900 verified the repository URL and order, inside/outside interaction, normal map rendering, and clean browser logs; manifest/render verification found 16 exact entries and 17 valid HTTP links. Final bun run check passed with 104 Node tests and 283 Bun tests. Cold simplicity and full-context complexity reviews found no remaining material change.
<!-- SECTION:FINAL_SUMMARY:END -->
