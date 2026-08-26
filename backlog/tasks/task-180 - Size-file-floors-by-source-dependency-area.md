---
id: TASK-180
title: Scale and order source-file floors
status: Done
assignee:
  - '@codex'
created_date: '2026-08-26 19:34'
updated_date: '2026-08-26 20:18'
labels: []
dependencies: []
references:
  - architecture-model
  - scanner-observation
  - markdown-emitter
  - validate-architecture
  - scan-reconciler
  - typescript-scanner
  - csharp-scanner
  - sheet
  - sheet-router
  - iso-projection
  - iso-map
  - web-viewer-details
modified_files:
  - src/types.ts
  - src/markdown-emitter.ts
  - scripts/validate-architecture.ts
  - src/scan-reconciler.ts
  - src/scanner/typescript/scan.ts
  - src/scanner/csharp/Scanner.cs
  - src/sheet/types.ts
  - src/sheet/measure.ts
  - src/sheet/place.ts
  - src/sheet/grid.ts
  - src/sheet/route.ts
  - src/sheet/scene.ts
  - src/viewers/web/iso/project.ts
  - src/viewers/web/iso/paint-buildings.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/camera.ts
  - src/viewers/web/organisms/details.ts
  - test-bun/sheet-scene.test.ts
  - test-bun/iso-map.test.ts
  - test-bun/web-task-camera.test.ts
  - test-bun/sheet-route.test.ts
  - test-bun/scanner-evidence.test.ts
  - src/scanner/csharp/test/ScannerTests.cs
  - docs/product-model.md
  - docs/viewers/web/index.md
  - groma/observed/systems/groma/containers/core/components/sheet.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/iso-projection.md
  - groma/observed/systems/groma/containers/web-viewer/components/iso-map.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/typescript-scanner.md
  - groma/observed/systems/groma/containers/scanner/components/csharp-scanner.md
  - groma/observed/systems/groma/containers/core/components/scan-reconciler.md
  - groma/observed/systems/groma/containers/core/components/sheet-router.md
  - groma/observed/systems/groma/containers/cli/components/commands.md
  - groma/observed/systems/groma/containers/cli/components/create.md
  - groma/observed/systems/groma/containers/cli/components/edit.md
  - groma/observed/systems/groma/containers/cli/components/instructions.md
  - groma/observed/systems/groma/containers/cli/components/naming.md
  - groma/observed/systems/groma/containers/cli/components/plain-world.md
  - groma/observed/systems/groma/containers/core/components/accept.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-model.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-reader.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-watch.md
  - groma/observed/systems/groma/containers/core/components/markdown-emitter.md
  - groma/observed/systems/groma/containers/core/components/project-profile.md
  - groma/observed/systems/groma/containers/core/components/world-layout.md
  - groma/observed/systems/groma/containers/core/components/world-loader.md
  - groma/observed/systems/groma/containers/scanner/components/scan.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/scanner-observation.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/action-path.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/layout.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/navigation-spatial.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/navigation.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/projection-camera.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/projection-routes.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/projection.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/relationship-text.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/screen.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/tree.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/work-focus.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/backlog-plugin.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/terminal-host.md
  - groma/observed/systems/groma/containers/web-viewer/components/iso-camera.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/project-editor.md
  - groma/observed/systems/groma/containers/web-viewer/components/web-server.md
  - src/architecture-model.ts
  - >-
    test/fixtures/core-view/groma/observed/systems/shop/containers/api/components/orders.md
  - test/architecture-model.test.ts
  - test/core.test.ts
type: feature
ordinal: 192000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer scans a project and opens groma web, each component compresses all of its source files into one to five visible floors. The project component with the fewest files has one floor and the component with the most files has five, with other components mapped linearly between them. Floors preserve every source file through grouping, use source dependency evidence for area, and descend from the largest footprint so upper floors never overhang lower floors.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every unique component source file belongs to exactly one visible floor group; no file is omitted or duplicated.
- [x] #2 Visible floor count maps component source-file count linearly across the project: the minimum maps to 1, the maximum maps to 5, intermediate values round to whole floors, and a component never has more floors than files.
- [x] #3 Files are ordered by dependency footprint before balanced grouping; each group uses the maximum LOC, dependency, and dependent measurement of its member files.
- [x] #4 Visible floors are ordered largest-first and their nested footprints guarantee that no upper floor is wider or deeper than any floor below it.
- [x] #5 Floor heightUnits map the grouped LOC measurement through the existing project-relative 1-to-4 half-unit scale; width maps dependents and depth maps dependencies.
- [x] #6 TypeScript and C# scanners emit deterministic file-to-file source-dependency evidence with the same contract, and two consecutive scans preserve curated ownership and measurements.
- [x] #7 Packing reserves the complete building envelope, routes touch the largest ground floor, and unrelated buildings do not overlap.
- [x] #8 Selected component build details identify every source file, its type, LOC, dependency count, and dependent count.
- [x] #9 Public documentation describes project-relative one-to-five floor compression and keeps floor count separate from heightUnits.
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
1. Finish the endpoint and measurement simplifications already accepted by the cold review. 2. Add one project-relative source-file-count range beside the existing file measurement ranges. 3. Sort source files by dependency footprint, partition them into a linearly mapped one-to-five number of balanced groups, aggregate each group with maximum member measurements, and derive nested largest-first footprints. 4. Preserve every grouped source file through projection and details. 5. Update tests, public docs, and observed architecture; run focused and repository checks; verify the supported flow in groma web; run a cold simplicity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Approved visual grammar: one file equals one floor. heightUnits is thickness from LOC. Width is dependents; depth is dependencies. Use simple project-relative linear min/max for all three axes unless real rendered evidence proves it insufficient. Git history is excluded.

The approved direction changed after visual review: buildings now compress all source files into a project-relative maximum of five visible floor groups. Grouping must preserve every file, and footprints must be nested largest-first.

Implemented project-relative one-to-five floor compression. Files sort by measured footprint, balanced groups keep every unique file, group dimensions use maximum member evidence, and a bottom-up envelope pass makes footprints nested. Because the largest floor is now always on the ground, the separate route attachment/obstacle rectangles were removed.

Verification: focused sheet, route, projection, scanner, architecture-model, and details checks pass. Live browser audit at http://localhost:4848/?system=groma found a maximum of five floors, grouped source files, zero non-nested towers, complete build details, and no console warnings/errors. Two consecutive scans reported 55 refreshed components and preserved the exact architecture hash. The cold simplicity review found one evidence gap and two clarity issues; the expected floor table and facadeFileType rename resolved all three, and the targeted re-review passed. The C# test command could not run because dotnet is not installed. The final bun run check passed 81/81 Node tests and 171/172 Bun tests; the only failure is a concurrency-only timeout in the unrelated TUI live Markdown test, which passes alone in 257 ms. Earlier full runs before the final naming/test-only review fixes passed 81/81 and 172/172.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added language-neutral TypeScript and C# source-dependency evidence, persisted per-file dependency measurements, and rendered component source files as project-relative one-to-five-floor buildings. Floors balance every unique file into deterministic groups, use maximum member measurements, and form nested largest-first towers with distinct facade patterns and complete build details. Verified with focused tests, stable repeat scans, live browser DOM/console inspection, and a cold simplicity review plus targeted re-review.
<!-- SECTION:FINAL_SUMMARY:END -->
