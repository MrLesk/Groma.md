---
id: TASK-29
title: Map existing Groma parts as observed and keep next work planned
status: Done
assignee: []
created_date: '2026-08-15 13:22'
updated_date: '2026-08-15 13:25'
labels: []
dependencies: []
references:
  - groma/README.md
  - docs/product-model.md
  - groma/observed/README.md
  - groma/plans/mvp/README.md
priority: high
type: feature
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hand-author this repository's architecture so the TUI world matches what exists and what is next. Observed holds people, Git, Groma, and the containers and components that already run. The MVP plan is only a fragment of new IDs that are not yet accepted. The user authorized editing groma/ Markdown directly because Groma cannot write these files yet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Observed includes the running Core, Terminal viewer, Scanner plugin, Architecture model, World layout, and Terminal interface
- [x] #2 The MVP plan fragment adds only IDs that do not yet exist; scan-reconciler stays planned with parent core resolved from observed
- [x] #3 Context relationships still read as people using Groma and Groma versioning through Git
- [x] #4 Architecture validation and the TUI suite pass against the rewritten world
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
1. Move running containers and components from the MVP plan into groma/observed: core, terminal-viewer, architecture-model, world-layout, terminal-interface, scanner-plugin, with code references to the files that implement them.
2. Leave scan-reconciler as the only MVP ghost; its parent is observed core.
3. Point people at the Groma system and Groma at Git so context still shows those uses.
4. Update observed and plan READMEs, TUI tests that pin planned IDs, then run architecture validation and bun run check.
5. Capture a headless context frame to confirm the world reads as a mixed observed/planned Groma.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Moved running Core, Terminal viewer, Architecture model, World layout, Terminal interface, and Scanner plugin into observed, with code references to the implementing files. MVP now contains only scan-reconciler; parent core resolves from observed.

People relate to the Groma system (Reads, Curates). Groma and the architecture workspace relate to Git (Versions). An observed document cannot yet link to a planned file (validator and plan model resolve paths differently), so scanner-plugin and scan-reconciler have no cross-origin relationship.

Verification: bun run validate:architecture reports 12 observed + 1 planned; bun run check passed (tsc, architecture, 85 Node, 6 TUI). Headless context shows people, Groma, Git; containers shows the four observed Groma containers inside the system boundary.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hand-authored the repository architecture so existing parts are observed and only scan-reconciler remains an MVP ghost. Verified with architecture validation (12+1 elements) and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
