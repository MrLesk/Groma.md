---
id: TASK-456
title: Generate social covers without a browser
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 13:38'
updated_date: '2026-09-20 14:01'
labels: []
dependencies: []
references:
  - map
  - cover
  - images
  - web-export
  - web-page
  - sharing-render
documentation:
  - docs/viewers/web/index.md
  - docs/component-markdown.md
modified_files:
  - src/viewers/web/iso/svg.ts
  - src/viewers/web/iso/text.ts
  - src/viewers/web/iso/paint-ground.ts
  - src/viewers/web/iso/paint-buildings.ts
  - src/viewers/web/iso/paint-routes.ts
  - src/viewers/web/iso/grid.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/atoms/theme.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/atoms/fonts/DejaVuSansMono.ttf
  - src/viewers/web/atoms/fonts/DejaVuSansMono-Bold.ttf
  - src/viewers/web/atoms/fonts/DejaVuSansMono-Oblique.ttf
  - src/viewers/web/atoms/fonts/DejaVuSansMono-BoldOblique.ttf
  - src/viewers/web/atoms/fonts/DejaVuSans.ttf
  - src/viewers/web/atoms/fonts/LICENSE
  - src/viewers/web/atoms/fonts/index.ts
  - src/viewers/web/page.ts
  - src/viewers/web/atoms/lockup.svg
  - package.json
  - bun.lock
  - src/viewers/web/sharing/cover.ts
  - src/viewers/web/sharing/images.ts
  - src/viewers/web/sharing/render.ts
  - src/viewers/web/runtime.ts
  - scripts/build.ts
  - docs/viewers/web/index.md
  - test-bun/web-sharing.test.ts
type: bug
ordinal: 528000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Static export currently needs installed Chrome through Puppeteer, so a small CI runner cannot publish its social covers. Alex approved direct shared SVG drawing and resvg WASM, with bundled fonts, after an isolated Linux experiment. Replace the browser requirement while preserving the approved architecture cover and initial sharing metadata.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Live and static delivery generate Light, Dark, and Blueprint PNGs without Chrome, a system font installation, or network access during image generation.
- [x] #2 Covers keep the approved continuous grid, real architecture without an enclosing card, glass footer, project title, Groma attribution, and invitation using shared map drawing and theme rules.
- [x] #3 The interactive map retains projection, labels, filtering, selection, routes, pan and zoom; web and exported covers use bundled shared fonts.
- [x] #4 The compiled CLI exports a nonempty fixture with valid initial Open Graph fields and 1200 by 630 PNGs in constrained Linux; obsolete browser capture code, dependencies, and instructions are removed.
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
When a project owner runs export, or a crawler requests a live cover, Groma produces the approved three themed PNGs without a browser or installed fonts.
1. Keep project title/description as standard OKF project metadata; covers are derived presentation assets, not C4 elements or new stored metadata. Existing SheetScene and projection own geometry across projects and languages.
2. Existing map painters produce pure SVG markup. The browser mounts that markup and owns DOM interaction; static covers consume the same drawing functions. Share base map styles, grid geometry, and scale/theme rules, resolving explicit values for rasterization.
3. Bundle DejaVu font assets for shared web/cover typography. Embed resvg WASM and font bytes in the CLI, generate the three PNGs in process, and delete Puppeteer plus the cover browser entry and registry branch.
4. Preserve initial OG metadata and existing live/export owners. Update sharing documentation and font loading in the page, preserving parallel header changes.
5. Test authority: the user requires generation in small CI and unchanged map behavior. Existing sharing tests check real PNG delivery but exercise an empty map. Extend the export case to the existing source-view fixture with real source files so the complete nonempty drawing path must render; retain PNG and metadata assertions. Existing projection, layout, camera, filtering, and presentation tests cover their rules. Visually inspect real-map output for missing drawing; no decorative assertions or duplicate unit tests are needed.
6. Verify all three real-map covers and interactive behavior. Run focused checks, cold simplicity review, implementer specification/quality review, full-context complexity review, and bun run check. Verify the compiled CLI offline with one CPU and 256 MB in Linux. Mark Done and commit/push task-owned changes only.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shared SVG painters and explicit static map styles are implemented; 38 focused sharing, projection, camera, presentation, and filtering tests passed before extending the export fixture. The first nonempty export extension used viewer-view, whose Markdown references absent source files, so it failed before cover generation. Reuse an existing export-ready fixture with real sources rather than weaken the PNG flow or add a product fallback. The real 125-element Groma map generated all three covers in 971 ms locally; font assets and the wordmark were visually checked.

The cold simplicity review identified a real static stroke regression: an explicit inherit declaration overrode route-base and calibration widths on the same element. Removed that redundant declaration; static children inherit naturally. The review otherwise recommends keeping the current domain boundaries and found no material simplification. Verification will rerun against the corrected rules.

Final verification: bun run check passed: 16 Node tests and 617 Bun tests, with 36 existing optional-runtime skips. Biome reported only existing warnings/information in unchanged files. The first full run timed out in unchanged sheet-compose port-capacity coverage while export/build benchmarks were also running. The complete file passed unchanged (2.27 s for that case), and the full suite passed with benchmarks stopped (2.54 s for the case); no test settings or assertions changed.

The final compiled Linux ARM64 musl CLI exported the nonempty source-view fixture with networking disabled, one CPU, and a 256 MiB memory limit. Export completed in 1.00 s with a cgroup peak of 144.77 MiB. All three PNG signatures and 1200x630 dimensions, absolute og:url/og:image, og:title, and the large-image Twitter card were verified from the generated files. A prior constrained run took 3.37 s and peaked at 142.97 MiB. These are local container measurements, not hosted CI timings.

Visual checks covered all three 125-element real-project covers. The current code generated all three locally in 764 ms. Browser checks of the compiled export confirmed direct map clicks and hierarchy selection, component visibility filtering, Isometric/2D/Layers switching, zoom, pan, labels and bundled typography. Shared drawing escaped authored text and retained route/group identities. The cold review's one targeted re-review confirmed corrected route and calibration widths.

Implementer specification review: all four acceptance criteria have supporting test, browser, artifact or constrained-build evidence. Implementer quality review: shared iso functions own drawing, map.ts owns interaction, sharing/cover.ts owns composition, sharing/images.ts owns PNG conversion, and atoms/fonts owns font bytes and their redistribution notice. No authority-backed blocking defect or additional required test was found. Changed source/test files remain below 500 lines and changed functions have no complexity warnings. Removed browser code/dependency references were checked across runtime, build, tests and active documentation.

Final full-context complexity review: no material findings. The reviewer recommends keeping the shared iso drawing, map-owned interaction, sharing composition/rasterization, and grouped font assets. These boundaries make the supported flow easy to follow and reduce duplicate appearance rules and host setup mistakes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Social covers now render from the same SVG drawing rules as the interactive map, using embedded resvg WASM and bundled DejaVu fonts. Live delivery and static export produce all three themed PNGs without Chrome, installed fonts, or runtime downloads. The cover browser entry and Puppeteer dependency were removed; initial sharing metadata remains intact. Full repository checks, visual/browser checks, both architecture reviews, and an offline compiled Linux export under one CPU and 256 MiB passed.
<!-- SECTION:FINAL_SUMMARY:END -->
