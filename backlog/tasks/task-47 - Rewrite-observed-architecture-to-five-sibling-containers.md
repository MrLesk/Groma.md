---
id: TASK-47
title: Rewrite observed architecture to five sibling containers
status: Done
assignee:
  - '@scan'
created_date: '2026-08-16 17:04'
updated_date: '2026-08-16 17:07'
labels: []
dependencies: []
references:
  - groma/observed
  - docs/scanners/typescript/observation.txt
documentation:
  - groma/observed/README.md
priority: high
type: docs
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone opens a viewer on this repository, the C4 world is CLI, Core, Scanner, Terminal viewer, and Web viewer as sibling containers under Groma. CLI starts the three modes. Those modes use Core. Architecture workspace is gone. Components match the standalone TypeScript dump. Groma versions through Git.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Observed has CLI, Core, Scanner, Terminal viewer, and Web viewer as Groma containers and no Architecture workspace
- [x] #2 CLI starts Terminal viewer, Web viewer, and Scanner; those modes use Core; Groma versions through Git
- [x] #3 Terminal viewer components are Camera, Layout, Navigation, Projection, and Tree; Web viewer components are Page, Render, and Scene
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
1. Add CLI. Remove Architecture workspace. Point Groma at Git. Keep CLI, Scanner, and Core relationships as in the approved picture.
2. Replace Map/Hierarchy/Details with Camera, Layout, Navigation, Projection, Tree. Replace Web map with Page, Render, Scene. Add Architecture reader and Markdown emitter under Core.
3. Point World layout at Projection and Scene. Update observed README, validation fixtures, and TUI tests that pin old IDs.
4. Run bun run check. Do not fold groma scan.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Observed is five sibling containers: CLI, Core, Scanner, Terminal viewer, Web viewer. Workspace removed. Groma → Git. CLI starts the three modes. Scanner → Core. World layout → Projection and Scene. bun run validate:architecture: 22 observed + 1 planned, 10 relationships. bun run check green (tsc, 61 node, 34 bun).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rewrote observed architecture to the approved C4 picture: CLI, Core, Scanner, Terminal viewer, and Web viewer as siblings. Architecture workspace is gone. Verified with architecture validation (22+1 elements, 10 relationships) and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
