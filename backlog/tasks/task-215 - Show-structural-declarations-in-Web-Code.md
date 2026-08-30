---
id: TASK-215
title: Show structural declarations in Web Code
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 15:10'
updated_date: '2026-08-30 15:36'
labels: []
dependencies: []
references:
  - source-viewer
  - web-viewer-details
  - render
  - web-server
modified_files:
  - src/viewers/web/source/methods.ts
  - src/viewers/web/source/structure.ts
  - src/viewers/web/source/control.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/render.ts
  - src/viewers/web/server.ts
  - src/viewers/web/source/view.ts
  - test-bun/web-live.test.ts
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/source-viewer.md
  - groma/observed/systems/groma/containers/web-viewer/components/web-server.md
  - docs/viewers/web/index.md
type: feature
ordinal: 228000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer opens How it is built for a component, Web Details presents the component TypeScript structure by owned file. Named top-level callables appear whether exported or module-private, classes group their named methods, and selecting any entry opens its declaration. Export status explains visibility but does not decide inclusion. This remains on-demand code evidence: the C4 map and architecture Markdown do not change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Code groups declarations by component-owned TypeScript file and preserves source order
- [x] #2 Named top-level function declarations and function-valued variables appear whether exported or module-private, while nested and anonymous functions do not become flat Code entries
- [x] #3 A named class appears as a section with its named public, protected, and private methods nested beneath it
- [x] #4 The existing Code reference symbol is identified as the entry point and export status is secondary information rather than an inclusion filter
- [x] #5 Selecting any listed declaration opens the existing source viewer at its exact line for both the working tree and a selected Git revision
- [x] #6 Focused automated tests and rendered browser validation cover file grouping, internal declarations, class methods, and source navigation
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
1. Replace the exported-only method reader with one Source viewer structure reader. It returns component-owned TypeScript files in authored order, with named top-level functions and function-valued variables, named classes, and class methods in source order. Each declaration carries only the line, structural kind, scope, and whether it matches the existing Code reference symbol.
2. Replace method-specific browser/server names and /methods.json directly with the structural Code contract and /code.json. Reuse Source control selection, revision cache, and exact-line drill-down; add no compatibility route or new architecture component.
3. Render Code as file groups. Top-level callables and classes are peers; class methods are nested one level. Entry, export/internal scope, and class-member access are concise secondary facts, and every named item opens Source viewer at its declaration line.
4. Expand the existing current/historical Web live test to cover multiple files, source order, module-private and exported callables, a symbol entry point, public/protected/private class methods, and exclusion of nested or anonymous functions. Use rendered browser validation for the visible grouping and click behavior.
5. Update the existing Source viewer and Web docs in place, run focused lint/type/tests, browser QA, and bun run check, then complete the required cold simplicity, specification, quality, and full-context architecture reviews before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced the exported-only method response with an ordered Code structure: authored TypeScript files contain top-level functions or classes, and classes own one nested level of named methods. Exact Code reference symbols mark entry points; export/internal scope and public/protected/private access remain secondary facts. Source control now requests /code.json and keeps its existing selection, revision cache, and exact-line navigation. Focused Biome lint and TypeScript checks pass. The current/historical live test passes outside the socket sandbox.

Rendered browser QA passed against a temporary two-file component: Code preserved authored file and declaration order, included internal top-level callables, grouped public/protected/private class methods, omitted a nested callback, and marked both authored symbols as entries. Clicking the private paint method produced component=details&file=src/details.ts&line=11&tab=how, selected only line 11, and logged no browser warnings or errors. The repository-wide check reached all stages but two unrelated scan-watch tests failed because the shared machine exhausted file watchers (EMFILE); focused TASK-215 tests remain 14/14 passing.

Cold simplicity review passed after two accepted reductions: current/historical Code payload expectations now share one helper and keep test-bun/web-live.test.ts at the 500-line limit; Source structure keeps only CodeDeclaration and CodeFile as public types. The targeted re-review found both issues resolved with no regression. Focused Biome lint, TypeScript checking, and 14 Web/Details tests pass after the cleanup.

Specification and implementation-quality reviews passed with no findings. The final full-context architecture review recommends keeping the design unchanged: Markdown owns component file membership, Source structure owns AST discovery, Source control owns selection/revision/cache/navigation, the server transports revision-bound results, Details owns grouping, and Source view owns exact-line presentation. It found no further code or concept to delete within scope and judged the single-selection-source, closed-union design safer for junior developers.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced exported-only Web Code methods with on-demand TypeScript 7.1 structural evidence grouped by component-owned file. Code now includes exported and internal top-level callables, nests public/protected/private class methods, marks authored symbols as entries, and reuses revision-aware Source navigation for exact declaration lines without changing the C4 map. Verified with focused Biome and TypeScript checks, 14 passing Web/Details tests, deterministic rendered browser interaction, cold simplicity/specification/quality reviews, and the final full-context architecture review; the repository-wide check's only failures were unrelated EMFILE scan-watch exhaustion.
<!-- SECTION:FINAL_SUMMARY:END -->
