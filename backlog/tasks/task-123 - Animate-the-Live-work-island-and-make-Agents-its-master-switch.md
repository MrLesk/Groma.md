---
id: TASK-123
title: Animate the Live work island and make Agents its master switch
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 10:55'
updated_date: '2026-08-23 11:15'
labels: []
dependencies: []
references:
  - render
  - iso-map
modified_files:
  - src/viewers/web/organisms/pins.ts
  - src/viewers/web/organisms/work-island.ts
  - docs/viewers/web/index.md
ordinal: 134000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex wants every agent indicator gone from the map with one toggle: Agents off hides the in-progress and the finished pins and chips alike, and Completed only matters while Agents is on. The island should also grow and shrink smoothly instead of jumping: when it unfolds or folds, when tasks appear or leave, and when a toggle adds or removes chips, its width and height ease from the old size to the new one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With Agents off no pin and no chip shows, whatever the Completed toggle says; with Agents on, Completed decides whether the finished ones show
- [x] #2 The island's width and height ease between sizes when it folds or unfolds, when a toggle adds or removes chips, and when tasks appear or leave; a repaint that changes nothing does not animate
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
1. src/viewers/web/organisms/pins.ts: fanOut() shows a pin only while Agents is on, and a finished pin only while Completed is on too.
2. src/viewers/web/organisms/work-island.ts: the same rule for the chips; rebuild() measures the island before and after replacing its children and, when the size changed, transitions width and height from the old size to the new one (pixel sizes only during the transition, cleared on transitionend); one padding for both states and one max-width, so the measured target is exact; the folded max-width and the max-width transition go.
3. docs/viewers/web/index.md: the toggles' rule and the eased resize.
4. Browser: Agents off hides all pins and chips with Completed on; the island's rect before, during and after a toggle; a repaint that changes nothing leaves the inline sizes empty.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser evidence (Chrome, 1600x900, tab fronted so transitions tick): Agents off with Completed on left 0 visible pins and 0 chips, the Completed toggle still pressed; Agents on restored 22 pins and 22 chips; Completed off then showed the 5 in-progress pins and chips only. Folding eased the island from 976 to 101 px (472 px at 120 ms) and unfolding from 101 to 976 (675 px at 120 ms), both transitions running from the old rect at the first frame, the inline sizes cleared on transitionend; Agents off ran a width transition from 976 to 383 px. A repaint with unchanged pins compares equal rects and sets nothing (code path; in a hidden tab transitions freeze at their first frame, which had earlier made a repaint restart one).

Review applied: the resize runs through island.animate() from the measured old size to the new one, with running animations cancelled first so a re-toggle starts from the size in flight; no inline sizes, no transition rule, no transitionend listener; the chips expression reads as the master switch. Post-review browser evidence (Chrome, visible tab): unfolding ran one 350 ms ease Animation from 101x42 to 976x62 (803x58 at 175 ms) and left no inline style or animation; Agents off removed all 22 pins and chips with a width animation from 976 to 383 px (500 px at 175 ms), Completed still pressed; Completed off while Agents off changed nothing and started no animation; a toggle during a running animation began from the mid-flight width (734.6 px); Completed off with Agents on kept the 3 in-progress pins and chips. bun run check green (136 bun).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Agents is the master switch: off hides every pin and chip, and Completed decides the finished ones while Agents is on. The island eases its width and height between sizes on fold, unfold, toggles and task changes through one Web Animation measured from the old rect to the new, with no animation when the size is unchanged. Verified by DOM script in Chrome (visible tab, sampled mid-animation) and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
