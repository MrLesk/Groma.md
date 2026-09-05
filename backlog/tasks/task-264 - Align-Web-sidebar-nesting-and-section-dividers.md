---
id: TASK-264
title: Align Web sidebar nesting and section dividers
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 17:46'
updated_date: '2026-09-05 17:58'
labels: []
dependencies: []
references:
  - flow-controls
  - web-shell
  - hierarchy
modified_files:
  - src/viewers/web/flow/list.ts
  - src/viewers/web/page.ts
  - src/viewers/web/organisms/hierarchy.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 303000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the Web sidebar hierarchy visually clear using the existing design language: actor accordions sit beneath Flows with the shared Unicode actor glyph, their flow rows sit one level deeper, and External systems has the same full-width separator used between Flows and Structure. Preserve collapsed startup, independent actor expansion and existing selection behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Actors use normal entity-row text and the shared actor glyph, indented beneath Flows; expanded flow rows are visibly nested beneath their actor.
- [x] #2 External systems is separated from the internal Structure by the same full-width rule and section spacing used between Flows and Structure.
- [x] #3 Collapsed and expanded layouts are visually verified, existing flow selection and folding still work, and bun run check passes.
- [x] #4 Established external systems use normal text contrast and the same selection treatment as internal systems; draft rows retain their existing styling.
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
1. Reuse existing entity-row typography, disclosure and glyph styles for actors, aligning their root columns with system rows. Nest flows by the same 23 px step used for containers. 2. Give External systems the existing full-width section divider and spacing; use draft styling only for draft origins. 3. Inspect light/dark collapsed and expanded states, measure alignment and external contrast in the browser, run the repository check and perform the requested final complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Alex found the first spacing revision too deeply indented. Corrected the layout rule: root actor rows use exactly the existing system-row columns; flow names sit one standard tree level deeper, aligning with container names. Removed the extra actor padding rather than layering another override.

Alex also identified dim text and selection on external systems. The hierarchy incorrectly applied its ghost class to all external rows. Removed that externality condition so only non-observed draft origins receive the draft style.

Visual verification after correction: actor and system names both start at x=60.23; flow names start at x=83 and container names at x=83.23, matching the 23 px tree step. The external separator and existing Flows separator both compute to a 1 px solid hairline. Selected Git and Groma both have full opacity and the same text colour. Light and dark screenshots confirm the corrected contrast and compact spacing.

Applied the child indent to the flow row itself rather than its parent, keeping row hover backgrounds full-width like the existing hierarchy rows without moving the measured text columns.

Final full-context review passed. Added its suggested source comment explaining why child flow row padding aligns with depth-one tree names while preserving full-width hover. No broader abstraction or additional tests recommended.

Final verification: bun run check passed on a snapshot of committed main plus only TASK-264 changes: lint, scrollbar rules, TypeScript, 104 Node tests and 301 Bun tests. The shared-workspace run encountered concurrent relationship changes outside this task. The first temporary-snapshot run hit sandbox filesystem watcher failures; allowing filesystem watching made the complete check pass without code changes. Browser checks covered startup collapse, independent expansion, flow selection, compact alignment, matching separators, and normal external-system selection contrast in light and dark themes. Implementer specification and quality reviews and the full-context complexity review passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Aligned actor rows with root systems and nested flows by one existing tree step. Added the shared actor glyph and a matching External systems divider. Established external systems now use normal text and selection contrast. Verified light/dark browser behavior and passed the complete repository check on the isolated task snapshot (104 Node and 301 Bun tests).
<!-- SECTION:FINAL_SUMMARY:END -->
