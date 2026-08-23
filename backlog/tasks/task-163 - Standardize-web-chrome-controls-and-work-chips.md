---
id: TASK-163
title: Standardize web chrome controls and work chips
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 21:08'
updated_date: '2026-08-23 21:13'
labels: []
dependencies: []
references:
  - page
modified_files:
  - src/viewers/web/page.ts
  - src/viewers/web/work/island.ts
type: enhancement
ordinal: 174000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer opens the web map, Groma shows consistent chrome controls and Backlog chips: the hierarchy toggle, details close button, and zoom buttons share the same 32 by 32 pixel visual size, the zoom group matches that height, and status filters use the same corner radius as task chips, matching the approved screenshots.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The hierarchy collapse or expand control and details close control render at 32 by 32 pixels.
- [x] #2 The zoom minus and plus controls render with the same 32 by 32 pixel visual size and their control group has the same visible height.
- [x] #3 Backlog status filters use the same corner radius as task chips.
- [x] #4 Rendered browser checks confirm the controls remain aligned and the hierarchy, details close, and zoom interactions still work.
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
1. Consolidate the repeated icon-only control dimensions and Backlog chip radius in the existing web CSS. 2. Run focused automated checks. 3. Verify dimensions, alignment, and interactions in the rendered web viewer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Consolidated the four icon-only controls under one 32px square CSS rule. The zoom group now derives an exact 32px outer height from those buttons by drawing its outline inside the box. Status filters and task chips now share one 20px radius rule.

Focused checks passed: 9 tests across web page, selection, and task camera. Full bun run check passed: TypeScript, 93 Node tests, and 177 viewer tests. Browser QA at 1280x720 measured hierarchy toggle, details close, zoom minus, zoom plus, and the full zoom group at exactly 32 by 32 pixels. Status filters and task chips both measured 38px high with a 20px radius. Zoom changed 100% to 125%; hierarchy toggled aria-expanded to false at 32px; details close hid the inspector.

Cold simplicity review and full-context acceptance, quality, and architecture review passed with no findings. Both reviews concluded that the shared selectors are the minimum solid approach; no generic component, class, token, test, or documentation change is needed for these decorative measurements.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Standardized hierarchy, details, and zoom icon controls at a measured 32 by 32 pixels, kept the full zoom group at the same height, and made Backlog status filters share the task chips 20px radius. Browser QA verified exact geometry and working collapse, close, and zoom interactions; bun run check passed TypeScript, 93 Node tests, and 177 viewer tests; both required reviews passed without findings.
<!-- SECTION:FINAL_SUMMARY:END -->
