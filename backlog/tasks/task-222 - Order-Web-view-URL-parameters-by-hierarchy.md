---
id: TASK-222
title: Order Web view URL parameters by hierarchy
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 17:09'
updated_date: '2026-08-30 17:27'
labels: []
dependencies: []
references:
  - render
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/url.ts
  - test-bun/web-url.test.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 235000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer shares or inspects a Web view link, Groma writes its query parameters in one stable broad-to-specific order so the URL reads as a path through the view: revision, selected subject, details tab, source file, source line, active flows, theme, then HUD state. Parsing remains order-independent and internal JSON endpoint queries are outside this page-state contract.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The shareable Web URL writes revision first; ordered actor, system, container, component, relationship or task selection next; then tab, file, line, repeated flow values, theme and hud
- [x] #2 Repeated architecture selections and flows keep their existing semantic order, defaults remain omitted, and readView accepts parameters in any order
- [x] #3 A component source link is written as ?component=layer-modes&tab=how&file=src/viewers/web/layers/orbit.ts&line=34
- [x] #4 Pure URL tests cover the canonical order and the Web viewer documentation lists every current shareable parameter in that hierarchy
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
1. Keep URL parsing order-independent, but make writeView emit one canonical hierarchy: revision; ordered selection; tab; selected component file and line; ordered flows; theme and HUD. 2. Extend the existing pure URL tests with one complete state, the requested component source example, and an out-of-order input that reads identically, while preserving the live TASK-220 tab work already in the shared files. 3. Update the Web viewer URL contract with every current page parameter in canonical order, then run focused checks, repository checks, and the supported browser flow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Moved source serialization out of selection ownership. writeView now emits selected subject, then its tab and source location, before independent flow and presentation state; readView is unchanged. Preserved the shared TASK-220 Tasks-tab behavior already present in url.ts.

Extended the pure URL fixture with every page-state group and the requested layer-modes source link. The same test now proves canonical writing and order-independent reading while preserving repeated selection and flow order.

Updated the Web viewer contract to name every current shareable parameter in canonical order, including revision and hud, and to separate ordered page state from internal request queries.

Focused URL tests pass (12/12), Biome passes, TypeScript passes, and git diff --check passes. Browser QA loaded the user's out-of-order layer-modes link through a fresh current-code server and rewrote it to component, tab, file, line. Back removed file and line; clicking clamp() restored the same canonical URL and selected line 34. The page rendered normally with no warning or error logs.

bun run check reached lint, TypeScript 7.1, and Node tests. TASK-222 files have no diagnostics; 88/90 Node tests passed. The same shared-machine scan-watch failures remain: the CLI watch case produced no stdout and watchScan hit EMFILE (too many open files). These are outside URL serialization and reproduced unchanged from the prior task.

Cold simplicity review passed with no findings. It confirmed that writeView is the right single visible ordering point, the primary selected element lookup is the minimum separation needed to place tab before source, and the complete and source-specific tests are both necessary.

Specification and implementation-quality reviews passed with no findings. They verified every acceptance criterion, canonical and order-independent behavior, complete parameter documentation, task-scoped ownership, and the recorded focused and browser evidence; TASK-220 hunks were excluded.

Final full-context architecture review passed with no findings. It recommends keeping the explicit writeView sequence instead of a rank table or generic sorter: selection writes selection, source writes source, one canonical writer exposes the hierarchy, and the complete expected-string test makes misplaced parameters easy for junior developers to detect.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made the Web view URL canonical and readable: revision, ordered selection, tab, file, line, ordered flows, theme, then HUD, while readView remains order-independent. Documented every current shareable parameter and verified the exact layer-modes link with 12/12 focused URL tests, Biome, TypeScript 7.1, diff checks, current-code browser navigation with empty logs, and simplicity, specification, quality, and full-context architecture reviews; the repository check remains limited only by the documented unrelated scan-watch EMFILE failures.
<!-- SECTION:FINAL_SUMMARY:END -->
