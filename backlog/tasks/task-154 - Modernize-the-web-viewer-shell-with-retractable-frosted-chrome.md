---
id: TASK-154
title: Modernize the web viewer shell with retractable frosted chrome
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 18:19'
updated_date: '2026-08-23 20:33'
labels: []
dependencies: []
references:
  - web-viewer
  - render
modified_files:
  - src/viewers/web/chrome/shell.ts
  - src/viewers/web/selection.ts
  - src/viewers/web/page.ts
  - src/viewers/web/organisms/hierarchy.ts
  - src/viewers/web/render.ts
  - test-bun/web-selection.test.ts
  - docs/viewers/web/index.md
  - groma/observed/systems/groma/containers/web-viewer/components/render.md
  - design-qa.md
  - src/viewers/web/iso/camera.ts
  - test-bun/web-task-camera.test.ts
ordinal: 165000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect opens groma web, the surrounding interface should feel like one modern technical instrument: the Live work panel, hierarchy, inspector, header and map controls share a restrained semi-opaque frosted language informed by the approved Groma and Departure Mono references. The global blueprint grid may remain visible beneath the chrome, while architecture objects stay inside the unobscured map viewport.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The full-screen isometric grid continues beneath the floating header, hierarchy and inspector; those chrome surfaces use the same 35%-paper frost as Live work in light and dark themes, while Live work keeps its code and styling unchanged
- [x] #2 The hierarchy pane uses the approved boxed double-chevron control, collapses to a clear rail and restores with one coordinated animation; its expanded tree uses quiet branch lines, and toggling it does not move, zoom or refit the map
- [x] #3 The inspector is absent whenever nothing is selected, opens wide enough for long task content, stays stable between concrete selections, and has a visible X that clears selection, closes the pane, returns focus to the map and leaves the camera unchanged; Escape and empty-sheet clicks use the same close behavior
- [x] #4 There is no System controls group or full-width footer; the header holds a Fit control with the approved four-corner icon, zoom out, readout and zoom in immediately before Help and an icon-labelled theme action
- [x] #5 Panel motion respects reduced-motion preferences, hidden panel content is not focusable, and a closing inspector returns focus to the map when necessary
- [x] #6 Focused behavior tests cover inspector ownership across selection kinds; relevant checks pass; browser QA and reference comparison cover fitted view, invariant camera across pane toggles, empty selection, task details, Help, Fit, theme action, panel opacity, and light and dark themes at 1280x720
- [x] #7 Selecting a task fits its touched components and outgoing highlighted routes with a wider context margin inside the unobscured map area
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
1. Make the existing map SVG the full-screen base layer, leaving the infinite isometric grid visible beneath every floating region.
2. Keep the chrome in the existing CSS grid as an overlay, match its frost to Live work at 35% paper, and place one icon-led Fit/zoom group in the header before Help and Theme.
3. Fit and focus through the clear area when explicitly requested, but do not observe floating pane geometry: hierarchy collapse and inspector close must leave the current camera untouched.
4. Add the theme icon and a visible inspector X; route X, Escape and empty-sheet close through the existing selection-clearing path and focus return.
5. Increase the existing task-highlight camera margin.
6. Update the web-view contract, run focused and full checks, compare the browser render directly with option 1, then repeat the required simplicity and architecture reviews.

7. Replace the temporary single-character hierarchy toggle with the approved bordered double-chevron icons.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation reached the browser QA gate. The first visual pass found map controls overlapping open Live work, Help stacking below the inspector, and hierarchy lines too faint. Fixed only the shell/control placement and branch treatment; Live work code remains unchanged. Focused checks and the full project check pass (93 Node tests, 175 viewer tests). Design QA evidence is recorded in design-qa.md with final result passed.

Cold simplicity review passed after correcting two stale documentation phrases: clearing selection now says the inspector closes, and the Live work island no longer references the removed footer.

Final architecture review found no blocking or optional implementation changes. It confirmed the chrome controller, selection-derived inspector ownership, hierarchy-domain rendering, CSS-grid geometry, and reuse of the existing camera fit path are the simplest solid boundaries for this scope. Final diff whitespace check passes.

User review reopened the visual acceptance: the grid must span the whole screen under floating panels, chrome opacity must match the 35%-paper Live work surface, zoom must sit below the inspector, and the theme action needs an icon. Previous acceptance checks were replaced and cleared.

The stable home for Fit and zoom is the header before Help and Theme. This removes the controls from the map and from inspector-dependent geometry; Fit keeps its four-corner icon and label.

Task focus needs more surrounding context than the previous 72px margin supplied, especially beside the wider inspector.

Final user review requires a visible inspector X and camera invariance across inspector close and hierarchy collapse. Pane geometry will no longer trigger the resize camera path; explicit camera actions remain unchanged.

The hierarchy toggle must match option 1: a compact bordered square with double-left and double-right chevrons.

Final browser QA passed at 1280x720: map SVG is full-screen; header and Live work both compute to 35% paper; Fit/zoom, Fit icon and theme icon are in the header; Help opens in the clear map area; task focus is 304% versus the earlier 372%; inspector X closes through selection clearing, makes details inert and returns focus to the map; hierarchy collapse and inspector close preserve the exact SVG transform; the boxed double-chevron matches option 1. Final bun run check passes with 93 Node and 176 viewer tests.

Final cold simplicity review passed after adding Live work repositioning to the reduced-motion rule. The full-context architecture review recommends no further changes: selection remains the only inspector authority, all close paths share deselect, the shell has no camera operations, and the code is grouped by chrome, hierarchy, selection, camera and work domains. The last isolated TASK-154 checks pass; a later shared-worktree type failure belongs to concurrent TASK-158 changes and is excluded from this commit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the approved floating web shell: a full-screen isometric grid under 35%-paper chrome, header-owned icon controls, boxed hierarchy collapse, a wider selection-owned inspector with X, camera-stable pane actions, and a wider task-focus margin. Verified at 1280x720 in light, dark, task, empty, Help, Fit, Live work and collapsed states; measured camera invariance and focus return; passed 93 Node tests, 176 viewer tests, focused rechecks, cold simplicity review and full-context architecture review.
<!-- SECTION:FINAL_SUMMARY:END -->
