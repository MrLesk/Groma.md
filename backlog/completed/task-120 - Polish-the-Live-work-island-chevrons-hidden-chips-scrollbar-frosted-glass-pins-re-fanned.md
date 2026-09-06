---
id: TASK-120
title: >-
  Polish the Live work island: chevrons, hidden chips, scrollbar, frosted glass,
  pins re-fanned
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 10:31'
updated_date: '2026-08-23 10:44'
labels: []
dependencies: []
references:
  - render
  - iso-map
modified_files:
  - src/viewers/web/organisms/pins.ts
  - src/viewers/web/organisms/work-island.ts
  - docs/viewers/web/index.md
ordinal: 131000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex's review of the Live work island: the chevrons point the wrong way (the folded pill should point up, the open island down); the Completed toggle (and by symmetry Agents) should also drop its chips from the bar, not only the pins; the chip strip's scrollbar should be minimal; the Done label inside the strip goes, the grey chips already say it; the island should be semi-transparent with a frosted-glass blur; and hiding pins must re-fan the ones still shown, so a lone pin moves back over its roof instead of standing off to the side with a leaning stem.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The folded pill's chevron points up and the open island's points down
- [x] #2 With Completed off the finished chips leave the strip as well as the map; with Agents off the in-progress chips do; the strip has no Done label
- [x] #3 The strip's scrollbar is a thin 4 px line
- [x] #4 The island is semi-transparent paper with a frosted-glass blur over the map
- [x] #5 Hiding either kind of pin re-fans the pins still shown on each element, so a pin standing alone returns to its roof point
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
1. src/viewers/web/organisms/pins.ts: keep the pins and both flags; fanOut() computes the fan only over the pins still shown and runs on paint and on show; the head and stem transition so a pin slides back.
2. src/viewers/web/organisms/work-island.ts: up-pointing chevron path (the open state keeps rotating it to point down); chips filtered by the toggles; no Done label; frosted background (70% paper over a 14 px blur) and a 4 px scrollbar on the strip.
3. docs/viewers/web/index.md: the island paragraph follows.
4. Browser: chevron directions, Completed off removes finished chips and pins and the lone pin on iso-map returns to --fan 0, scrollbar height, computed backdrop-filter.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser evidence at 1280x800: folded chevron path points up with no rotation, open rotates it 180 degrees (down); island background color(srgb 1 1 1 / 0.7) with backdrop-filter blur(14px) saturate(1.3); no .done-label; strip scrollbar-width thin and the 4 px webkit rule present; Completed off left 2 open chips and 0 finished pins, Agents off as well left 0 chips, both back on restored 18; on the render element the five pins fan at -92..92 px, with Completed off the lone TASK-120 pin stood at --fan 0px / --lean 0rad, and back on the fan restored. bun run check green (92 node + 134 bun).

Cold simplicity review applied: one scrollbar mechanism (the 4 px webkit rule; Chromium ignores it once scrollbar-width is set, which had left an 11 px bar), chips built from live and finished lists gated by the toggles, backdrop-filter without the prefixed copy and saturate, the hairline token for the border, and fanOut() owning visibility through the hidden attribute (the hide-* classes are gone). Post-review browser evidence at 1280x800: folded chevron path points up with no rotation and the open rule rotates it 180 degrees; background color(srgb 1 1 1 / 0.7) with backdrop-filter blur(14px); no Done label; strip scrollbar 4 px (offsetHeight minus clientHeight); Completed off left 2 chips and hid all 16 finished pins with the lone render pin at --fan 0px / --lean 0rad, Agents off as well left 0 chips and 0 visible pins, both back on restored 18 chips, 18 pins and the -92..92 px fan. bun run check green (92 node + 134 bun).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The chevron path points up while folded and turns down when open; the Agents and Completed toggles hide their chips as well as their pins, the strip lost its Done label and shows a 4 px scrollbar; the island is 70% paper over a 14 px backdrop blur; fanOut() re-spaces the pins still shown on each element and hides the rest, so a lone pin slides back over its roof. Verified by DOM script in Chrome at 1280x800 (chevron rotation, computed background and backdrop-filter, scrollbar height, chip and pin counts per toggle state, --fan and --lean of the lone pin) and bun run check (92 node + 134 bun tests).
<!-- SECTION:FINAL_SUMMARY:END -->
