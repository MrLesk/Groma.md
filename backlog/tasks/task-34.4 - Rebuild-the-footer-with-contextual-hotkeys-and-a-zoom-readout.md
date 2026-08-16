---
id: TASK-34.4
title: Rebuild the footer with contextual hotkeys and a zoom readout
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 11:17'
updated_date: '2026-08-16 12:13'
labels: []
dependencies:
  - TASK-34.1
parent_task_id: TASK-34
priority: high
type: feature
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The footer shows only the hotkeys that apply to the focused pane, plus zoom controls with a readout of camera state: fit when the whole map fits, a percentage between, and 1:1 at the closest zoom. The z level strip and its focus mode are deleted; the hierarchy pane owns level jumps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Footer hotkeys change with the focused pane
- [x] #2 Zoom readout shows fit at whole-map fit, a percentage in between, and 1:1 at closest zoom, updating as the camera zooms
- [x] #3 The z strip, its keybinding, and its focus mode are removed from code, keys, and docs
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. navigation.ts: delete the zoom focus, zoomSlot state, moveZoomSlot, and jumpView; ViewerFocus becomes architecture|hierarchy; dismiss only leaves the hierarchy pane.
2. terminal-viewer.ts: drop the z key and the strip's Enter zoom; +/- remain the only zoom keys.
3. chrome.ts: footer = contextual hotkeys for the focused pane on the left, zoom controls with a readout on the right; pure zoomReadout(zoom, fitZoom) returns fit, a percentage, or 1:1.
4. Tests: delete strip-based tests and the strip-highlight helper; unit-test zoomReadout; keep zoom-key behavior tests. Docs drop the z strip and describe the footer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity review applied: drawChrome takes a plain focus parameter, unit test renamed, docs reflowed. Verified live with agent-tty: footer shows map hints with '· fit', Tab switches to hierarchy hints, '=' zoom updates the readout to 12%. zoomReadout unit-tested for fit/percent/1:1. Net -157 lines with the z strip, zoom focus, zoomSlot, and jumpView deleted.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The footer now shows contextual hotkeys for the focused pane and zoom controls with a fit/percent/1:1 readout from the camera; the z level strip, its focus mode, and its jump machinery are deleted from code, keys, tests, and docs. Verified by the concurrent suite (20 pass) and live agent-tty checks of hint switching and the zoom readout.
<!-- SECTION:FINAL_SUMMARY:END -->
