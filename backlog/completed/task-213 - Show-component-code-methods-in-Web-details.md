---
id: TASK-213
title: Show component code methods in Web details
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 12:51'
updated_date: '2026-08-30 14:03'
labels: []
dependencies: []
references:
  - source-viewer
  - web-server
  - render
  - web-viewer-details
modified_files:
  - package.json
  - bun.lock
  - src/viewers/web/source/methods.ts
  - src/viewers/web/server.ts
  - src/viewers/web/source/control.ts
  - src/viewers/web/source/view.ts
  - src/viewers/web/url.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/render.ts
  - test-bun/inspect-details.test.ts
  - test-bun/web-url.test.ts
  - test-bun/web-live.test.ts
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/source-viewer.md
  - groma/observed/systems/groma/containers/web-viewer/components/web-server.md
  - docs/viewers/web/index.md
type: feature
ordinal: 226000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer opens How it's built for a component in the Web viewer, Groma separates semantic TypeScript code from source-file evidence. Code lists meaningful declarations from the component's referenced files and selecting one opens the existing source viewer at its declaration line. Files contains the current file rows and measurements. The architecture map and sheet do not change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A selected component's How it's built tab shows separate Code and Files sections, and Files retains the current source-file links and measurements
- [x] #2 Code lists meaningful callable TypeScript declarations from the component's referenced files using a pinned TypeScript 7.1 development API, without writing method data into architecture Markdown
- [x] #3 Selecting a Code entry opens the existing source viewer at the declaration line and makes that line visibly identifiable
- [x] #4 Method locations come from the same working tree or historical Git revision as the displayed architecture and source
- [x] #5 Focused automated tests and rendered browser validation cover the details list and method-to-source interaction
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
1. Add one source-viewer method reader that uses the pinned TypeScript 7.1 unstable async AST API to return exported function declarations and exported function-valued variables from only the selected component TypeScript Code files.
2. Expose those methods through a revision-bound on-demand Web endpoint and let Source control cache them while its active immutable element object and revision stay unchanged; a live-world replacement naturally invalidates the cache.
3. Split the How it is built surface into Code and Files: Code shows callable declarations with source locations; Files retains the complete existing file rows, measurements, authored symbol, and scanner.
4. Extend the existing source drill-down and URL state with an optional declaration line, then center and visibly mark that line when source loads.
5. Cover extraction, current and historical endpoint behavior, Code and Files section ownership, and URL line state with focused tests; run the full repository check and browser interaction QA.
6. Run the required cold simplicity, specification, quality, and full-context architecture reviews. Apply only in-scope corrections and present the contextual findings to Alex before final completion.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one Source viewer path: the pinned TypeScript 7.1 development API reads directly exported function declarations and function-valued variables from only the selected component TypeScript Code files. The Web server exposes revision-bound method and source reads; Source control owns method caching, selection, and optional line navigation; Details renders Code and Files without adding a diagram component. The scanner initially proposed a separate Methods component for the new file; that appended architecture was removed and the file was folded into Source viewer instead.

Quality review found one supported live-update defect: cached methods could survive a watched TypeScript edit. Source control now keeps results only while the exact immutable selected element object and revision remain active, so replacement of the live world invalidates them without a second generation input. The proposal to remove the authored symbol was rejected because Alex explicitly asked Files to retain the full previous Code evidence. A new DOM assertion was also rejected because project policy reserves automated tests for business logic; rendered browser interaction provides the visible evidence.

Cold simplicity review removed the method response wrapper, repaired the on-demand fixture anchor, and renamed the Files test; its targeted re-review passed. Specification review found no blockers. Quality re-review found no remaining blocker. Existing Source viewer relationship labels were restored so AST detail does not alter C4 map data. The full-context architecture review found no blocker and recommended removing the element parameter from SourceControl.methods because Source control already owns the active element. Alex approved it, and SourceControl.methods now reads that selection internally.

Verification passed for focused Biome lint, the TypeScript 7.1 typecheck, Details and URL tests, immutable-world cache behavior, exact current and historical method reads, and browser Code/Files plus method-to-line navigation with an empty console. A full repository check passed with 81 Node and 175 Bun tests before later shared-workspace additions. After the final cache simplification and concurrent additions, 81 Node tests and 176 of 177 Bun tests passed; the sole unrelated architecture-watch timeout passed alone.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Separated Web Details into AST-derived Code declarations and complete Files evidence. Pinned the TypeScript 7.1 development runtime, bound methods and source to the current or historical revision, and reused Source viewer and URL state to center and mark declaration lines. Source control owns its active selection and invalidates method results when the immutable live-world element changes. Focused checks and browser interaction pass; the only later full-suite failure was an unrelated architecture-watch timeout that passed alone.
<!-- SECTION:FINAL_SUMMARY:END -->
