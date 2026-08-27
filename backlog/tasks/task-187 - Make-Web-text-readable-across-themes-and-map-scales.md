---
id: TASK-187
title: Make Web text readable across themes and map scales
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 15:27'
updated_date: '2026-08-27 15:36'
labels: []
dependencies: []
references:
  - shell
  - page
  - iso-map
  - flow-controls
  - project-editor
  - work-overlay
modified_files:
  - src/viewers/web/atoms/theme.ts
  - src/viewers/web/page.ts
  - src/viewers/web/iso/scale.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/flow/row.ts
  - src/viewers/web/project/editor.ts
  - src/viewers/web/work/badge.ts
  - src/viewers/web/work/pins.ts
  - src/viewers/web/work/island.ts
  - test-bun/theme.test.ts
  - test-bun/iso-scale.test.ts
type: bug
ordinal: 199000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect opens the Web viewer, all text remains readable in light, dark, and Blueprint themes. Small map surface labels must not appear before they have a readable on-screen size, and selected labels, work pins, badges, controls, and editor text must meet normal-text contrast.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Surface labels remain hidden until they render at a readable screen size and appear as the user zooms in
- [x] #2 Selected map labels meet a 4.5:1 contrast ratio while selection remains visibly accented
- [x] #3 Every work-pin task label, badge face, and completion face meets a 4.5:1 contrast ratio for every configured pin colour
- [x] #4 Chrome, controls, details, layer labels, editor text, and accent text meet a 4.5:1 contrast ratio in light, dark, and Blueprint themes
- [x] #5 Theme cycling, F2 layers, map selection, work pins, pan, and zoom keep their existing behavior
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
1. Add semantic foreground tokens for accent text and text placed on accent/colored surfaces.
2. Reuse the existing camera label-visibility rule for all projected surface labels and raise its threshold to a readable screen size.
3. Keep selected map labels in high-contrast ink while selection remains visible through accent geometry.
4. Make work badges and pin labels use their colored surface plus one tested dark foreground.
5. Add contrast and label-visibility tests, run bun run check, then verify all three themes and interaction states in the browser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Audit evidence: Blueprint surface-label colors pass at 5.8–6.9:1 but render at only 1–7 px at common map scales. Selected building labels measure 3.79:1. Work-pin task labels measure 2.17–4.23:1; the white completion mark on green measures 3.39:1. Existing work from TASK-183 is present in shared files and must remain untouched.

- Added theme-aware accent text plus one dark on-accent foreground. Light accent text is 5.31:1; dark is 5.50:1; Blueprint is 5.30:1. The on-accent foreground is 5.85:1 against the shared accent and at least 4.68:1 across all configured pin colours.
- Reused the camera names-hidden state for island, slab, zone, and building labels and raised the readable font threshold from 6 to 10 screen pixels.
- Selected/touched/lit map labels now remain ink while their geometry remains accented. Work task plates use on-accent; badge fronts use ink on paper; completion faces and active flow checks use on-accent. Other accent text uses the theme-aware accent-text token.
- Focused tests pass: 14 tests across theme, scale, page, work badge, and work pins.
- Browser QA passed across light, dark, and Blueprint. Fit had 0 visible surface labels; stepped zoom first revealed 82 labels at a 12.12 px minimum. Selected component text measured 11.02:1 with an accent stroke. Visible pin plates measured 4.68–6.59:1, badge fronts 15.53:1, completion faces 5.85:1. F2 preserved theme/selection and showed three 12.5 px layer labels; editor text remained readable.

- Final implementation review: renamed the shared saturated-surface foreground from `onAccent` to `onColour` because it also serves task-pin colours. The flow remains direct: theme tokens feed the existing CSS modules, the existing camera visibility gate controls all surface labels, and selection keeps accent geometry with ink text. No new component, state, or abstraction is needed, and every changed source file remains under 500 lines.
- Repository verification: focused suite passed 14/14. A complete `bun run check` passed before the semantic token rename; after that name-only cleanup, the complete suite twice passed 177/178 and exposed two unrelated file-watcher timing failures. Each failing watcher file passed immediately in isolation (`work.test.ts` 9/9 and `viewer-live.test.ts` 3/3). Node tests passed 81/81, type checking passed, and lint reported only the existing 42 complexity warnings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made Web text readable across light, dark, and Blueprint themes by adding semantic high-contrast foreground tokens, hiding all projected surface labels until readable scale, keeping selected labels in ink with accent geometry, and correcting work-pin, badge, flow, details, and editor foregrounds. Verified WCAG contrast ratios, label reveal scale, selection, pins, F2 layers, editor, pan/zoom, and theme cycling in the browser; focused tests passed 14/14 and each transient watcher failure passed immediately in isolation.
<!-- SECTION:FINAL_SUMMARY:END -->
