---
id: TASK-264
title: Align Web sidebar nesting and section dividers
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 17:46'
updated_date: '2026-09-05 18:10'
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
  - src/viewers/web/organisms/sidebar-row.ts
  - groma/systems/groma/containers/web-viewer/components/web-shell.md
  - groma/systems/groma/containers/web-viewer/components/sidebar-row.md
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
- [x] #5 Flows, actor groups, and flow rows have clearly increasing, evenly spaced nesting; actor disclosure arrows sit close to their icons.
- [x] #6 Grouped flow rows omit their redundant actor prefix while keeping the authored flow title available elsewhere.
- [x] #7 The same compact disclosure, icon, and nesting spacing applies throughout the sidebar structure tree and actor flow groups.
- [x] #8 Container and system counts remain visible when expanded; actor groups show their flow count using the same row component and count styling.
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
1. Use one shared sidebar row for actor and software glyphs, disclosure controls, labels and persistent counts. 2. Apply a 16 px nesting step with compact shared icon columns throughout the sidebar, placing actors beneath Flows and child flows one level deeper. 3. Remove matching actor-name prefixes only in grouped flow labels. 4. Verify both groups and the expanded software tree in light and dark themes, preserve selection and folding, run bun run check, and complete the final complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Alex found the first spacing revision too deeply indented. Corrected the layout rule: root actor rows use exactly the existing system-row columns; flow names sit one standard tree level deeper, aligning with container names. Removed the extra actor padding rather than layering another override.

Alex also identified dim text and selection on external systems. The hierarchy incorrectly applied its ghost class to all external rows. Removed that externality condition so only non-observed draft origins receive the draft style.

Visual verification after correction: actor and system names both start at x=60.23; flow names start at x=83 and container names at x=83.23, matching the 23 px tree step. The external separator and existing Flows separator both compute to a 1 px solid hairline. Selected Git and Groma both have full opacity and the same text colour. Light and dark screenshots confirm the corrected contrast and compact spacing.

Applied the child indent to the flow row itself rather than its parent, keeping row hover backgrounds full-width like the existing hierarchy rows without moving the measured text columns.

Final full-context review passed. Added its suggested source comment explaining why child flow row padding aligns with depth-one tree names while preserving full-width hover. No broader abstraction or additional tests recommended.

Final verification: bun run check passed on a snapshot of committed main plus only TASK-264 changes: lint, scrollbar rules, TypeScript, 104 Node tests and 301 Bun tests. The shared-workspace run encountered concurrent relationship changes outside this task. The first temporary-snapshot run hit sandbox filesystem watcher failures; allowing filesystem watching made the complete check pass without code changes. Browser checks covered startup collapse, independent expansion, flow selection, compact alignment, matching separators, and normal external-system selection contrast in light and dark themes. Implementer specification and quality reviews and the full-context complexity review passed.

Alex reviewed the committed layout and found the actors too close to the Flows heading level, the arrow-to-icon gap too wide, and child flows too deeply nested. Reopened this task to correct the visual hierarchy and remove redundant actor prefixes from grouped labels.

Alex also identified the same wide disclosure gap in Structure and explicitly requested a uniform sidebar change. The revision now applies shared row spacing to systems, containers, components and actors, with one 16 px nesting step.

Alex asked to retain expanded counts, show counts for actor flow groups, and reuse the row implementation. The row markup and count rendering will be shared by both sidebar sections.

Uniform revision implemented: sidebarRow now owns disclosure, glyph, name and count markup for actor groups and software rows. Counts remain visible in either expansion state. The actor group computes its flow list once and uses that list for both its count and rows. Grouped labels omit only a prefix that matches the actor name or its ending role. Browser verification measured root software labels at x=49, actors and containers at x=65, and flows and components at x=81, with a 4 px arrow-to-icon gap throughout. Coding agent and Human architect both show six flows; Groma (6) and CLI (10) retain counts when expanded. Selecting shortened browser review opens the original Agent: browser review reader and preserves actor state; collapsing that actor keeps the selection. Dark-theme and reload checks passed. The final bun run check passed in the shared workspace after stopping the preview; no test-only code changes were needed. Implementer specification and quality reviews passed.

The final full-context review passed with no blocking findings or material recommendations. The scanner discovered the new sidebar-row helper as an empty component; combined its Code reference into the existing Web shell shared-controls responsibility through Groma so the helper does not add a separate architecture box.

Both post-curation scans created zero components and kept sidebar-row.ts owned by Web shell. Final validation: 104 Node tests and 301 Bun tests passed; seven existing lint warnings remain outside this change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Web sidebar uses one shared entity-row component with compact arrow/icon columns, a consistent 16 px nesting step, and counts visible while expanded or collapsed. Actor groups show their flow counts and omit redundant actor prefixes from grouped flow labels. External systems retain the matching divider and normal selection contrast. Verified light/dark browser layouts, counts, independent folding and flow selection; bun run check passed all 405 tests. The final complexity review passed, and two scans preserved the helper under the existing Web shell responsibility.
<!-- SECTION:FINAL_SUMMARY:END -->
