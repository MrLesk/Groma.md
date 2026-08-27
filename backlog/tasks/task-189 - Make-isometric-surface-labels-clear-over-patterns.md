---
id: TASK-189
title: Make isometric surface labels clear over patterns
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 18:21'
updated_date: '2026-08-27 18:26'
labels: []
dependencies: []
references:
  - iso-map
modified_files:
  - src/viewers/web/iso/style.ts
type: bug
ordinal: 201000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect reads container, system, or group surface names in the Web map, Groma shows each name on a quiet solid plate with enough typographic weight to stay clear over grids, grain, and hatching in every theme.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Container surface names remain clear over their grain pattern in dark and Blueprint themes
- [x] #2 System and group surface names use the same readable label treatment
- [x] #3 The label plate fully separates text from underlying map decoration without becoming a new floating decoration
- [x] #4 Light-theme labels remain readable and the existing label position, reveal scale, selection, pan, zoom, and F2 behavior do not change
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
1. Reuse the existing grid-anchored surface label plate rather than adding a new decoration.
2. Make the plate opaque so map patterns cannot show through the name.
3. Give all surface-name text one medium weight while preserving the existing theme colours and projection.
4. Verify dark, Blueprint, and light in the browser, then run repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The failure is visual interference, not insufficient token contrast: the current label plate is 75% opaque and normal-weight text sits over visible hatch/grain.

- Browser QA refined the initial fix: an opaque plate and medium weight removed pattern noise, but muted group text remained weak at the isometric angle. Group names now inherit normal map ink like the other surface names; hierarchy still comes from the existing geometry and font size.
- Browser evidence at 1819%: Blueprint `Web runtime` uses solid `#04182B`, `#D8F3FF` text, and weight 600; dark uses solid `#111315`, `#E6E8EB` text, and weight 600; light uses solid white, `#22262E` text, and weight 600. Label origin/projection were unchanged. Theme cycling, zoom, and entry into the three-plane F2 view remained functional, with no console warnings or errors.

- Direct simplicity review (no agents, per request): the existing `surfaceText(..., chip=true)` primitive already groups islands, slabs, and zones by domain. The final diff only makes that existing plate solid, removes the one muted group-name exception, and applies one shared weight rule. No new colour, markup, geometry, state, component, test abstraction, or selector branch is needed. The 214-line stylesheet remains below the file limit and the flow is clear for a junior developer.
- Verification passed: focused Web page, layer mode, theme, and scale tests 11/11; `bun run check` passed type checking, 81 Node tests, and 180 Bun tests. Lint reported only the existing 43 complexity warnings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made all projected surface names readable over map decoration by turning the existing grid-anchored label chip into a solid plate, applying medium text weight to island/slab/zone names, and removing the muted group-name exception. Browser QA verified Blueprint, dark, and light colours at the label reveal scale with clean console output; focused tests passed 11/11 and the complete repository check passed 81 Node plus 180 Bun tests.
<!-- SECTION:FINAL_SUMMARY:END -->
