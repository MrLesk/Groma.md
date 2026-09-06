---
id: TASK-58
title: Keep Core light by moving fold and accept into their own files
status: Done
assignee:
  - '@alex'
created_date: '2026-08-16 19:25'
updated_date: '2026-08-16 19:31'
labels: []
dependencies: []
references:
  - src/core.ts
  - src/scan-reconciler.ts
  - groma/plans/mvp/systems/groma/containers/core/components/scan-reconciler.md
documentation:
  - docs/product-model.md
priority: high
type: chore
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone inspects this repository, Core is the thin runtime that loads one annotated world for viewers. Folding a scan and accepting a ghost are separate Core components, each in its own source file, so a TypeScript scan can see them. The existing scan-reconciler plan ghost can then match and be accepted. Callers still reach those operations through Core so they stay children of Core, not sibling containers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 foldScanResult and acceptGhost live in their own source files; core.ts keeps loadArchitectureViewModel
- [x] #2 groma view, groma scan, and groma accept still work through Core
- [x] #3 groma scan matches scan-reconciler and groma accept scan-reconciler applies it into observed
- [x] #4 Every changed source and test file is at or under 500 lines
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
1. Move foldScanResult and its match/index/path helpers into src/scan-reconciler.ts. Move acceptGhost into src/accept.ts. core.ts keeps loadArchitectureViewModel and re-exports the two write operations so CLI, scanner, and viewers still import through Core.
2. Point existing tests at the same Core exports. No new test file unless a current import breaks.
3. Run the TypeScript dump, then groma scan and groma accept scan-reconciler so the ghost becomes observed. Curate a one-line observed Accept document if scan creates that new file empty.
4. Update the TypeScript expected dump if this repo's mapping changes. bun run check. Every touched file stays at or under 500 lines.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Callers still import through core.ts so Accept and Scan reconciler stay Core children. Core's own symbol is now loadArchitectureViewModel. groma scan printed created 2, refreshed 22, matched 1; groma accept scan-reconciler printed ok. Deleted the out-of-scope action-path.md this scan also created. Wrote a one-line body on observed accept.md. Updated expected.txt and the MVP plan README (plan complete).

Verification: bun run check — tsc clean, 61/61 node, 41/41 bun. Cold simplicity PASS.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved foldScanResult into src/scan-reconciler.ts and acceptGhost into src/accept.ts. core.ts now loads the annotated world and re-exports those two writes. A scan matched scan-reconciler; groma accept scan-reconciler applied it into observed. bun run check passed (61 node, 41 bun).
<!-- SECTION:FINAL_SUMMARY:END -->
