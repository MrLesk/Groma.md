---
id: TASK-115
title: Show live agent pins on the web map
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 09:47'
updated_date: '2026-08-23 10:04'
labels: []
dependencies: []
references:
  - web-server
  - render
  - iso-map
ordinal: 126000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents work on Groma in parallel and Backlog knows where: every In Progress task carries assignees, element refs, modified files and acceptance criteria. The web map should show that live, as in Alex's mockup: one pin per assignee and task standing on the element the task touched last, a round badge with the assignee's mark inside a radial progress ring (checked acceptance criteria over total), the task id in a label under the badge and a stem down to the element. When the task is Done the badge flips to a green checkmark with a flip animation and stays for 24 hours; hovering flips it back to the mark with the reverse animation; a tooltip shows the full task title. A Live agents card in the map's top-right corner lists one row per assignee and task (badge, name, task id, progress, element) and clicking a row selects the element. Each assignee and task pair has its own colour from a fixed palette, assigned in task-id order; the map itself stays white, grey and green. Pins update through the existing Backlog watch and SSE channel. A badge shows the assignee's two-letter monogram, or an inline SVG mark when one is registered for that handle (Alex asked for vendor marks; the assets are theirs to drop in).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every In Progress task, and every Done task updated within the last 24 hours, shows one pin per assignee on the element it touched last: the element whose code holds the task's newest modified file, else the task's first referenced element
- [x] #2 A pin shows the assignee's two-letter monogram in a round badge, a radial ring filled by checked acceptance criteria over total, the task id under the badge, a stem to the element, and a tooltip with the full task title
- [x] #3 A Done task's badge flips to a green checkmark with an animation; hovering flips it back to the monogram with the reverse animation
- [x] #4 Each assignee and task pair has its own colour from a fixed palette in task-id order, used on its ring, badge, label and card row; the map's own colours are unchanged
- [x] #5 The Live agents card lists one row per pin with badge, assignee, task id, progress and element name; clicking a row selects that element
- [x] #6 Changing a task in Backlog (status, assignee, refs, modified files, acceptance criteria) moves or updates the pins in the open page without a refresh
- [x] #7 The web viewer doc describes the pins and CLAUDE.md tells agents to record modified files on their task
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
1. src/types.ts ActiveWorkItem gains status, updatedAt, modifiedFiles and acceptance {done, total}; src/backlog-plugin.ts reads the task list once (status, updatedAt), views the In Progress tasks and the Done tasks updated in the last 24 hours, and fills those fields; projectActiveWork (TUI) keeps marking In Progress items only.
2. src/work-pins.ts (pure): pinsOf(items, world, now) returns one WorkPin per assignee and task: key, assignee, monogram, taskId, title, status, done, total, elementId (the element whose code holds the task's last modified file, else the first referenced element), references, colour index (pairs in task-id order over a fixed palette). Tasks touching no element give no pin.
3. src/viewers/web/payload.ts carries pins; src/viewers/web/server.ts creates the Backlog plugin (or takes a workSource option), adds pins to every payload and republishes on the Backlog watch.
4. src/viewers/web/iso/map.ts: anchorOf(id) gives the roof or top centre of an element in world pixels. src/viewers/web/organisms/pins.ts: HTML overlays in #map: badge with monogram, radial ring by done/total, task id label, stem, tooltip with the title, 3D flip to a green checkmark when Done and back on hover (reverse on hover of a Done pin); the Live agents card top-right with one row per pin, click selects the element; placePins(camera) repositions on every move. render.ts wires boot, world events and camera moves.
5. Tests: test-bun/work-pins.test.ts (inclusion window, stand element, fallback, dropped tasks, stable colours, progress), the plugin test with statuses and criteria, a web-live test with a fake work source whose change reaches /events.
6. docs/viewers/web/index.md Live agents paragraph; CLAUDE.md: record modified files with backlog task edit --modified-file.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built: ActiveWorkItem carries status, updatedAt, modifiedFiles and acceptance; the Backlog plugin lists all tasks once and views those In Progress or Done within 24 h; projectActiveWork (TUI) keeps In Progress only. src/work-pins.ts pinsOf() gives one pin per assignee and task on the element holding the task's last modified file, else its first referenced element, colours in task order. The web server takes a work source (Backlog by default; a read failure counts as no work, as the TUI treats it), ships pins in every payload and republishes on the Backlog watch. Browser: organisms/pins.ts draws HTML pins anchored at the roof centre from map.anchorOf(); pins sharing an element fan out 46 px apart with stems leaning back to the roof point; badge = ring by done/total + monogram (MARKS map ready for vendor SVGs) + task id label + tooltip; Done flips to the green checkmark, hovering the head flips back; the Live agents card top-right folds by its heading and scrolls. Verified in the browser: 14 pins on the live board (TASK-115 and TASK-40 in progress, twelve finished in the last day), rows in the card, fan offsets -92..92 px on sheet, done cards at rotateY(180), no console errors; the web-live test proves a work-source change reaches /events. Found while verifying: the card can cover pins on a narrow map pane, hence the fold; the CLAUDE.md symlink was clobbered by an in-place edit and restored (the rule lives in AGENTS.md).

Simplicity review applied: WorkPin.references and ActiveWorkItem.updatedAt dropped (the day window reads the list JSON), one markup skeleton per pin with update filling it, anchor and fan resolved once at paint and only the camera applied on place, the Live agents fold removed (not in the task; on a narrow map pane the card can cover pins, a follow-up for Alex), names clarified (host, agents, painted), nameOf passed once, the leftover test title fixed. Kept: the MARKS map (Alex asked about vendor marks; monogram fallback) and the injected clock in the plugin for deterministic tests. Final check green (92 node + 134 bun); browser re-check after the rewrite: 14 pins, fan offsets, hover flip-back on a finished pin verified through computed transforms.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web map now shows live agent pins from Backlog: one per assignee and task on the element the task touched last, a ringed badge with the assignee's monogram (or a registered mark), progress by checked acceptance criteria, the task id, a stem and a tooltip; finished pins flip to a green checkmark and back on hover; pins sharing an element fan out; a Live agents card lists them and selects on click; everything republishes through the Backlog watch and SSE. Verified by the work-pins, plugin, page and live-server tests and in the browser against the real board.
<!-- SECTION:FINAL_SUMMARY:END -->
