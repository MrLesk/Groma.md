---
id: TASK-438
title: Filter the Web map by C4 element type
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 09:56'
updated_date: '2026-09-20 13:45'
labels: []
dependencies: []
references:
  - render
  - web-page
  - map
  - c4-filter
modified_files:
  - src/viewers/web/chrome/c4-filter.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - test-bun/web-c4-filter.test.ts
  - docs/viewers/web/index.md
ordinal: 511000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer exploring the map needs compact controls beside the hierarchy pane to show or hide C4 element types without changing the architecture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Toggles hide the chosen map elements, their attached routes and pins, and restore them without changing stored architecture, layout, or camera.
- [x] #2 Filtering survives map view changes and live updates; focused tests and the repository check verify the supported flow.
- [x] #3 A floating vertical bar beside the hierarchy provides tiny icon toggles for Actors, Systems, Containers, and Components, using modern versions of the existing circle, large square, parallelogram, and small square symbols, with accessible names and visible active states.
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
1. Keep the accepted C4 filter behavior, theme colors, and centered 16px glyphs.
2. Keep the header project title and controls at 12px, with counts at 10px. Preserve the intact 32px-high logo.
3. Use natural text line boxes and flex centering; remove cap-height trimming and its padding workaround so project lettering is not cropped. Retain horizontal ellipsis when space is limited.
4. Verify the reported project title and header at normal and enlarged size, then run bun run check. No decorative tests are needed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a page-local visibility filter in chrome/c4-filter.ts. The control filters projected scene bodies and routes after projection, preserving geometry and bounds. render.ts uses remaining map anchors to filter pin painting. It does not change the world, hierarchy, selections, OKF documents, C4 ownership, or language-specific behavior. This is a viewer concern owned by the browser session; ordinary Markdown/OKF readers see the same architecture.

Focused validation: 11 tests pass across web-c4-filter and web-map-presentation. Browser verification on viewer-view: four 32px icon buttons, pressed states, keyboard Space and focus labels, expanded/collapsed hierarchy placement, no camera transform change on toggle, component bodies/routes hidden in Iso and Layers, task pin removed and restored, and filters retained across periodic snapshot updates. Specification and quality self-review traced control click -> hidden-kind set -> projected scene filter -> map painter -> visible pin anchors. No supported-flow defect or extra architecture concept found. Initial sandbox check encountered local-server restrictions; unrestricted bun run check is running.

Final unrestricted bun run check passed: lint and TypeScript completed; Node tests passed; Bun viewer suite finished with 604 pass, 35 skip, 0 fail. The lint warning is pre-existing complexity in test-bun/iso-map.test.ts. Final diff whitespace check passed; render.ts remains 499 lines. No separate review agents were needed for this bounded viewer feature.

User correction: the first version renamed Actor to People and invented unrelated icon shapes. Replace those choices with the existing Groma labels and glyph shapes. Filtering behavior remains unchanged.

Correction implemented: labels now come from shared kindLabel; Actors replaces People. SVG geometry mirrors the established filled circle, large square, outlined parallelogram, and small square. Only the filter control and its documentation changed in this revision. Visual inspection confirmed shape hierarchy and keyboard tooltip/focus states. The targeted self-review found no change to filtering, projection, or pin behavior.

Final verification after icon correction: bun run check passed, including lint, TypeScript, Node tests, and 608 passing Bun tests with 35 skips and zero failures. No decorative-content tests were added.

User approved the neutral theme mapping on 2026-09-20. The correction stays in the existing C4 filter stylesheet and retains the shared floating surface, icons, and filtering behavior.

Theme correction verified on a fresh fixture preview in Light, Dark, and Blueprint. Enabled filters match the map-view control: paper-colored icons on ink backgrounds. Browser computed styles confirmed selected hover retains the same colors; Space toggled Components off to muted icons on a transparent background, hid its map bodies and pin, and clicking restored them. Existing server on port 4747 retains its prior build. Specification and quality self-review confirmed this CSS-only change keeps all filtering logic and shared surfaces unchanged. No new tests or documentation changes were needed for decorative styling. bun run check passed: lint, TypeScript, Node tests, and 614 Bun tests with 36 skips and 0 failures; git diff --check passed.

Alex approved fixing both screenshot findings. The enlarged filter screenshot shows glyph centers 1.5 screenshot pixels down/right from button centers, while the normal-size DOM boxes are centered. Header counts use 9px text centered beside the 10px project name. Coordinated page.ts ownership with TASK-454; its separate theme-font and sharing changes will be preserved.

Alignment correction completed: C4 SVGs use a block-level 16px square inside the existing 32px buttons; header project name/counts share a text baseline. Browser measurements showed zero center offset with whole-pixel SVG bounds at normal size and 300% CSS zoom. Enlarged screenshots confirmed centered marks and a shared text baseline; Light, Dark, and Blueprint presentations were checked. This corrects the reported visual defects without changing filtering, keyboard handling, glyph shapes, or architecture. Specification and quality self-review found no additional blocking issue; TASK-454 page.ts changes remain intact. bun run check and git diff --check passed. No decorative tests were added.

The latest screenshot shows the wordmark below the project summary. The earlier correction aligned only the name and counts. The logo text baseline is y=82 inside a 120-unit viewBox, while the centered SVG box is 26px tall; its baseline must participate in the shared header alignment.

Completed the remaining wordmark alignment fix. The header logo now has an inline wrapper with zero line height and an SVG vertical offset derived from its authored baseline (82 of 120 viewBox units). The header context shares that real baseline with the project summary and revision control. A comment documents the SVG measurement; no arbitrary visual nudge or logo asset change is needed. Verified complete header screenshots at normal size and 300% CSS zoom, with counts visible and hidden and the revision control visible. Targeted specification/quality review confirms the previous icon/theme fixes remain intact and shared TASK-454 changes are preserved. bun run check passed: lint, TypeScript, Node, and 617 Bun tests with 36 skips and 0 failures. git diff --check passed; page.ts is 426 lines.

Alex rejected the shared-baseline treatment and requested centered header content with independently positioned Groma art. Replace the preceding baseline solution directly; keep the accepted filter colors and icon centering.

User clarification: retain the Groma logo as one image and center its groma.md lettering in the bar. The implementation keeps the original lockup SVG intact and shifts that whole image upward by 2px; symbol and text retain their original relative positions. Header text/control boxes use center alignment, and the rejected baseline wrapper has been removed.

Final centered-header revision verified at normal size and 300% CSS zoom. Header and summary centers both measured y=108 at the enlarged scale; the intact logo SVG is deliberately offset 6 rendered pixels (2 CSS pixels) upward so its lettering is visually centered. The original logo asset and all internal artwork/text positions remain unchanged. Revision controls retain centered positioning. The rejected baseline wrapper and rules are gone. Targeted self-review found no remaining supported-flow issue. bun run check passed with 617 Bun tests, 36 skips, and no failures, plus lint/TypeScript/Node checks; git diff --check passed.

The marked screenshot exposes a gap in earlier verification: centered outer boxes did not prove that differently sized letters were centered. Investigating the actual glyph bounds and native CSS text-box trimming, documented by Chrome, to remove font-leading space rather than adjusting the whole header by eye.

Visible-letter alignment correction verified: CSS text-box trimming removes leading around the project name and count capitals, while both retain their existing font sizes. The original single-image logo is unchanged; its complete image moves upward 1px. At 300% CSS zoom in Chrome the header center is y=108 and both trimmed text centers are y=107.996. In the in-app browser at normal size the header center is y=36 and text centers are y=35.992 and y=35.984. Enlarged and normal screenshots confirmed the lettering aligns, with the revision control present. Targeted specification and quality self-review confirmed page.ts owns these presentation rules, without wrappers, logo splitting, filtering changes, or unrelated edits. The final bun run check passed (lint, TypeScript, Node, and 617 Bun tests; 36 skipped, zero failures); git diff --check passed. No decorative tests were added.

Alex requested uniform 12px header text and a proportionally larger intact logo. This extends the same header presentation refinement; no map behavior or architecture changes are required.

Uniform header sizing implemented in page.ts: stats, zoom percentage, and map-control buttons use 12px; counts inherit the same size. The original logo SVG scales from 26px to 32px high without changing its artwork. Browser computed styles confirmed 12px for project name, counts, revision text, search, Fit, and zoom controls. Screenshots at normal size, 300% CSS zoom, and a 1000px viewport showed the larger logo, aligned lettering, and fitting controls. Specification and quality self-review traced the existing page CSS to the rendered header; this remains a single-file presentation change with no new behavior, abstractions, or decorative tests.

Final validation for the 12px header revision passed: bun run check completed lint, TypeScript, Node tests, and 617 Bun tests with 36 skips and zero failures. git diff --check passed. All changes for this request remain in page.ts and the task record; unrelated working-tree changes were preserved.

The live Chrome page confirms the project name uses 12px text in an 8.75px cap-height box with overflow:hidden. That clips glyph edges; counts use the same trimming with visible overflow and remain intact. The fix belongs to the project-name rule in page.ts.

Alex rejected constrained text boxes and asked for counts at 10px while retaining the 12px title and current logo. Remove the text-box trimming rule and its compensating padding directly; normal line boxes own text height. The existing flex alignment centers the differently sized text.

Final visual verification uses natural line boxes: project title is 12px with an 18px line height, counts are 10px with a 15px line height, both have zero padding and text-box:normal. The logo remains the intact 32px image. The reported Groma.md title renders fully at normal size and 300% zoom. Specification and quality self-review confirmed clipping came from the removed trimming rule; horizontal ellipsis remains supported. The main worktree check is blocked by missing map-painter exports during TASK-456. Running the required full check against an isolated HEAD snapshot with only TASK-438 source changes, preserving the other task’s work.

Validation completed: bun run check passed in the isolated HEAD snapshot with the TASK-438 page/filter source changes (lint, TypeScript, Node tests, 617 Bun tests, 36 skips, zero failures). This isolates the header fix from TASK-456’s unfinished map refactor; the shared-worktree check was attempted and its unrelated failures recorded above. git diff --check passed. Browser verification confirmed uncropped project lettering and the requested 12px title/10px counts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added compact C4 filters with familiar glyphs and theme colors, preserving map layout and camera. Header project text and controls use 12px, counts use 10px, and the intact logo is 32px high. Natural line boxes prevent vertical cropping; flex layout centers the text and horizontal ellipsis handles limited width. Normal and enlarged browser views pass. The full repository check passes with the task changes isolated from concurrent map-renderer work.
<!-- SECTION:FINAL_SUMMARY:END -->
