---
id: TASK-193
title: Soften Web graph-paper grid at every zoom
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 18:55'
updated_date: '2026-08-27 18:59'
labels: []
dependencies: []
references:
  - iso-map
  - shell
modified_files:
  - src/viewers/web/iso/map.ts
  - src/viewers/web/atoms/theme.ts
  - src/viewers/web/page.ts
type: bug
ordinal: 205000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect views the Web map, the graph-paper grid stays visible as quiet drafting context without competing with architecture at Fit, distant zoom, or close zoom.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Major grid lines remain distinguishable from minor grid lines without matching the visual strength of architecture geometry
- [x] #2 At Fit and distant zoom, the surviving major grid does not dominate the map
- [x] #3 At close zoom, the combined minor and major grid remains a quiet background
- [x] #4 The five-cell cadence, world anchoring, theme cycle, projection, and layer behavior remain unchanged
- [x] #5 Blueprint shows both minor and major grid levels clearly when close enough for minor lines to appear
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
1. Return minor and major grid lines to one shared screen-constant stroke, keeping the existing five-cell cadence and scale decluttering.
2. Derive both grid colours from each theme’s paper and geometry line using one shared pair of colour-mix ratios, deleting theme-specific grid tokens.
3. Verify Fit and close zoom in all themes plus F2 projection in the browser, then run repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed the 1.5 px major stroke and restored one shared 1 px screen-constant grid stroke. Major cells will now differ only through the shared colour hierarchy.

Replaced six theme-specific grid colours with one design-system rule: minor grid is a 12% mix of each theme’s geometry line into its paper; major grid is 20%.

Removed Blueprint-only grid opacity overrides so all three themes now follow the same stroke and colour-mix rule.

Browser QA at http://localhost:4747 verified one shared grid rule in light, dark, and Blueprint. At Fit, minor lines are hidden and the 1 px major grid remains quiet. At 244%, both 1 px levels appear; computed colours use the same 12%/20% paper-to-line mix in every theme. Blueprint now shows minor lines without a theme-only opacity reduction. F2 produced System, Container, and Component layers and recomputed the pattern transform. Console had no warnings or errors.

Cold simplicity review: the rendered flow is one pair of derived grid variables -> the existing minor/major SVG paths -> one shared camera-corrected stroke. This deletes six palette values, two Blueprint-only opacity rules, and the separate major-stroke update. No new concept, selector, component, or decorative test remains. Full bun run check reached 81 passing Node tests and 182 passing Bun tests, but two Bun tests in the concurrently unfinished TASK-192 revision-history feature failed; neither failure exercises or references grid styling. Task-scoped Biome, TypeScript, 19 focused tests, three-theme browser QA, F2, and console checks pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Unified Web grid styling across all themes. Minor and major lines now share one 1 px screen stroke and derive from each theme’s paper and geometry line at 12% and 20%; Blueprint’s special opacity reduction was removed. Browser QA verified quiet Fit and close-zoom grids in light, dark, and Blueprint, preserved five-cell/F2 behavior, and a clean console. Task-scoped lint, TypeScript, and 19 tests pass; the full shared-workspace run is blocked only by two unrelated unfinished TASK-192 tests.
<!-- SECTION:FINAL_SUMMARY:END -->
