---
id: TASK-38
title: Refresh the observed architecture Markdown
status: Done
assignee:
  - grok
created_date: '2026-08-16 14:14'
updated_date: '2026-08-16 14:22'
labels: []
dependencies: []
references:
  - groma/observed
  - groma/README.md
documentation:
  - docs/viewers/tui/index.md
  - docs/viewers/web/index.md
priority: high
type: docs
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The observed architecture no longer matches the running product. Terminal viewer and Terminal interface are the same thing, the TUI panes are missing as components, and the web viewer is absent. Rewrite the groma/ Markdown so the C4 world is accurate and readable. Groma cannot write these files yet; this task authorizes a direct edit of groma/.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Terminal viewer contains Map, Hierarchy, and Details; Terminal interface is gone
- [x] #2 Observed includes the running Web viewer and its map
- [x] #3 Observed README and relationship tables describe the current world without duplicate or stale names
- [x] #4 Architecture validation and bun run check pass against the rewritten world
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
1. Replace terminal-interface with map, hierarchy, and details under terminal-viewer, with code references to projectWorld, drawHierarchy, and drawDetails.
2. Add web-viewer and web-map for groma web, with web-map pointing at buildScene.
3. Point World layout at Map and Web map. Have Core supply the world to both viewers. Do not also draw the reverse arrows.
4. Rewrite observed element prose so names and tables match the running product. Keep the existing World building group.
5. Update observed/README.md (container index only) and docs/viewers/web/index.md.
6. Update validation tests that pin element counts and index links. Run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Applied cold simplicity review: dropped reverse viewer→Core and map→World layout relationships; README links only containers. Kept World building group (TASK-33 example, not introduced here). Validation 16 elements / 12 relationships. bun run check green (56 node, 30 bun).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rewrote observed architecture so it matches the running product. Terminal viewer is Map, Hierarchy, and Details. Web viewer and Web map are observed. Terminal interface is gone. Verified with architecture validation (16 observed + 1 planned, 12 relationships), bun run check (tsc, 56 node, 30 bun), and specification/quality reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
