---
id: TASK-452
title: Use quieter Blueprint blue with Groma green highlights
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 12:18'
updated_date: '2026-09-20 12:23'
labels: []
dependencies: []
references:
  - settings-control
modified_files:
  - src/viewers/web/atoms/theme.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 524000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The developer compared Blueprint color variants in the live map and chose quieter blue with the original Groma green. Apply that approved combination through the shared Blueprint theme so it is available on normal visits and in static exports.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Blueprint uses the approved navy background (#07152B), blue geometry (#527CB0), and pattern blue (#2C496C).
- [x] #2 Blueprint selection, active flows, and shared interaction emphasis use Groma green (#1D9E75).
- [x] #3 The approved palette is supplied by the normal shared theme without temporary preview controls or overrides.
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
1. Replace the five approved Blueprint palette values in the existing shared theme, using the brand constant for interaction highlights. This remains display configuration owned by Display settings; no OKF or C4 concepts change. 2. Update the existing Blueprint description, preserving unrelated documentation edits. 3. Validate the real map and active flow after removing browser preview overrides; run bun run check. This is a color-only change: no new tests of palette literals or new behavior are needed. 4. Perform the implementer review and the user-requested full-context complexity review, then finalize and commit only this task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified a fresh CLI export in the browser with no preview override: paper #07152B, geometry #527CB0, pattern #2C496C, highlight and highlight text #1D9E75. Selected component outlines and all ten active flow paths resolve to rgb(29, 158, 117). The running port-4747 server holds the previously imported palette until restarted; it was left running. bun run check passed, including 608 Bun tests (36 skipped, zero failed). Implementer specification and quality reviews passed: the approved five palette values flow through cssBlock into the shared page and existing map styles, with no new branch, module, dependency, behavior, or color-literal test. The documentation change describes the saved palette. Unrelated working-tree edits are excluded from the task diff.

Final full-context complexity review found no material defects or simplifications. The existing Display settings domain remains the single owner of palette values; shared CSS variables carry them to the page, components, and flows. Biome reported one existing complexity warning in test-bun/iso-map.test.ts and two existing informational suggestions outside this task; the repository check exited successfully.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Applied the approved quieter Blueprint blue and Groma green interaction highlights through the existing shared palette, and updated the theme description. Verified a fresh CLI export without browser overrides, including selected component outlines and active flows. bun run check passed; the full-context complexity review found no changes needed.
<!-- SECTION:FINAL_SUMMARY:END -->
