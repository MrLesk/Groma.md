---
id: TASK-454
title: Generate themed architecture covers and Open Graph metadata
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 12:56'
updated_date: '2026-09-20 13:15'
labels: []
dependencies: []
references:
  - web-page
  - web-export
  - map
  - src-cli
  - cover
  - images
  - sharing-render
  - metadata
documentation:
  - docs/viewers/web/index.md
  - docs/component-markdown.md
modified_files:
  - src/viewers/web/atoms/theme.ts
  - src/viewers/web/page.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/sharing/cover.ts
  - src/viewers/web/sharing/render.ts
  - src/viewers/web/url.ts
  - src/viewers/web/sharing/metadata.ts
  - src/viewers/web/runtime.ts
  - scripts/build.ts
  - package.json
  - bun.lock
  - src/viewers/web/sharing/images.ts
  - src/viewers/web/export.ts
  - src/cli.ts
  - src/viewers/web/map-session.ts
  - test-bun/web-sharing.test.ts
  - docs/viewers/web/index.md
type: feature
ordinal: 526000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Project links need a useful social preview that belongs to the Groma visual system. Alex approved a cover with the real architecture above a bottom glass panel, one continuous grid, the project title, By Groma branding, and an Explore the architecture invitation. Generate variants from existing themes and project information. Theme-path selection is owned by the completed TASK-453; this task owns the cover and sharing metadata, not hosting configuration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The project cover follows the approved continuous-grid preview: architecture has no surrounding card; the bottom panel shows the project title, Groma mark and attribution, and Explore the architecture.
- [x] #2 Light, Dark, and Blueprint covers use the existing map geometry, drawing rules, fonts, and theme values rather than an independent architecture or palette model.
- [x] #3 Shared Web pages include Open Graph title, description when authored, website type, page URL, and an image with matching theme, dimensions, type, and alternative text in their initial HTML.
- [x] #4 Static export produces the cover assets used by its metadata, and live delivery exposes the same cover design; the normal map remains usable.
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
The project owner exports or serves a Groma map; a social crawler reads initial HTML and a 1200×630 PNG without running JavaScript.

1. The existing project title and optional standard description own sharing text. Covers are derived web assets, not new OKF records or C4 elements. Core SheetScene still owns geometry.
2. web/sharing groups cover HTML composition, the browser entry, PNG capture, and sharing metadata. The cover uses presentScene, createMap, fitCamera, mapCss, shared theme/font tokens, and the existing brand asset. The map supports a fixed grid scale for the approved continuous field behind the footer.
3. puppeteer-core renders all three covers in installed Chrome (or GROMA_CHROME). No browser download or managed cache. Source and standalone builds share an explicit registry of the map and cover browser entries.
4. Live delivery emits metadata from the request URL and creates/caches PNGs on the first image request, invalidating them after map changes. Export writes PNGs before index.html; --url supplies the public directory URL and selects the cover with the shared URL theme rule. Auto uses light. Without a public URL, HTML keeps a relative light-cover link and omits og:url. Hosting/path deployment remains separate.
5. Test authority: the approved sharing flow requires initial project metadata and an existing theme-matched PNG. Existing coverage already checks URL precedence and map projection. Three small fixture-based tests close the delivery gap by reading initial head fields and actual PNG signatures/dimensions for live and export; optional description and Auto behavior are checked without decorative assertions. Manual visual checks cover the actual Groma map in all themes; browser interaction checks cover the ordinary exported map.
6. Complete focused checks, the cold simplicity review, implementer specification/quality reviews, the final full-context complexity review, bun run check, and compiled CLI export verification. Record evidence, mark Done, and commit/push only task-owned changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation choice: use installed Chrome through puppeteer-core; no browser download or managed browser cache. Export publication URL is explicit; Auto uses the light social cover. Initial cover rendering and TypeScript check passed; visual check caught a containing-block size issue, now fixed.

A real overlap was reported by TASK-438 in page.ts. Their change is #stats align-items: baseline; ours is the font token and sharing head. Agreed to preserve their hunk and stage separately.
Test decision detail: existing web-theme tests already prove path/query precedence. New sharing tests will inspect initial head metadata and fetch/write the referenced PNG, checking its PNG signature and 1200×630 dimensions; this catches missing/wrong-theme assets and omission of authored project description. A second metadata test verifies that absent description stays absent and Auto selects light. Reuse the empty-project fixture for delivery and a minimal project-profile value for authored description; actual architecture composition is covered by existing map tests and manual three-theme rendering.

Focused verification: 15 tests passed for sharing delivery, theme URLs, and map presentation. All three real-project PNGs generated successfully and were visually checked. The first full check found a TypeScript inference error in a test URL local; added its string type. Full-project static-source export also hit an existing missing C# scanner runtime; no scanner configuration or fallback was changed.

Cold simplicity review completed with no blocking findings or material simplification recommended. It confirmed the four sharing files have clear ownership and the fixed grid scale is scoped to the approved cover.
Implementer specification review: real-project Light/Dark/Blueprint PNGs visually match the approved continuous-grid layout; initial live/export metadata and all assets pass the focused delivery tests; the compiled standalone CLI exports 1200×630 PNGs with correct Blueprint URLs.
Implementer quality review: traced CLI → export snapshot → shared cover page/browser renderer → PNGs and initial metadata; live requests use the same owners and invalidate image cache on map changes. No second layout or palette, no new stored metadata, no unapproved fallback. Tests observe initial head/actual image bytes and do not freeze decorative details. New/changed functions pass Biome complexity checks; source files remain below 500 lines. Browser verification on a nonempty exported fixture confirmed zoom 100%→125%, fitting, and selecting a container with updated details/URL.
Full bun run check passed: 16 Node tests, 617 Bun tests, 36 existing skips; 0 failures. Standalone build and compiled export smoke test passed. Existing unrelated lint warnings remain.

Final full-context complexity review passed: no blocking findings or material changes recommended. The reviewer confirmed one theme resolver, filename function, cover size, and map renderer reduce junior-developer mistakes. The running scanner discovered component IDs for the new sharing files; these IDs are referenced here, while its generated architecture files remain outside this task commit. Temporary verification tabs and servers have been closed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the approved continuous-grid architecture cover in Light, Dark, and Blueprint using the existing map renderer, themes, typography, and branding. Live pages and exports emit initial Open Graph metadata from the existing project profile; export accepts --url and writes all three PNGs. Installed Chrome is required only for generation.

Verified with real-project three-theme images, browser zoom/selection on a published fixture, 15 focused tests, the standalone binary export, and bun run check (16 Node + 617 Bun passed, 36 existing skips). Both simplicity/complexity reviews found no blockers. Full-source export of this checkout still requires its unrelated C# scanner runtime.
<!-- SECTION:FINAL_SUMMARY:END -->
