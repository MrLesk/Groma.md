---
id: TASK-494
title: Move the web map between views without rebuilding it every frame
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 06:28'
updated_date: '2026-09-23 16:48'
labels: []
dependencies: []
references:
  - map
  - map-sharing
  - render
  - map-debug
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/iso/svg.ts
  - src/viewers/web/iso/text.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/iso/paint-ground.ts
  - src/viewers/web/iso/paint-buildings.ts
  - src/viewers/web/iso/paint-routes.ts
  - src/viewers/web/layers/paint.ts
  - src/viewers/web/sharing/cover.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/render.ts
  - test-bun/unidentified-container.test.ts
  - docs/viewers/web/index.md
  - src/viewers/web/chrome/map-debug.ts
  - src/viewers/web/iso/glow.ts
  - groma/systems/groma-md/containers/export/components/map.md
type: enhancement
ordinal: 575000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Switching the web map between Iso, 2D and Layers drops frames. Measured on 2026-09-23 in Chrome on a Mac (1440×806, Groma's own map: 116 buildings, 59 routes, about 4,000 map nodes): pan and zoom run at 120 fps and never touch the SVG, while a view switch runs at 73–75 fps with the main thread 84% busy and a 50 ms first frame. Every frame of a switch re-projects the sheet, rebuilds every map layer from HTML strings (about 4 ms parse, 3.5 ms style, 1.5 ms layout and 2 ms paint per frame), re-applies every highlight class and pin, and forces a synchronous style and layout. Dragging the Layers orbit and settling world updates use the same full repaint; world updates skip their animation above 500 surfaces because of it.

The selection glow adds to this. Its border pulse is an SVG stroke animation, so it repaints the map SVG on every frame, at rest (about 6% of the main thread while a component is selected) and while panning (107 ms of SVG painting per 900 ms of panning with a component selected, against 2 ms without). During a view switch the halo is rebuilt every frame, which restarts its breathing. Alex decided that the glow must not show while the map moves.

Agreed direction, co-architected with Alex: one map painter that reuses its nodes, so a paint that draws the same items only rewrites their geometry; surface titles after a zoom go through that painter; the camera writes straight into the SVG while the painter animates; the border lightening is removed and only the halo breathes, on its own layer. Pan and zoom keep moving the cached layer and never repaint.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Switching between Iso, 2D and Layers, dragging the Layers orbit, and a settling world update keep the drawn elements: items drawn in consecutive frames keep their elements, only parts that appear or disappear are created or removed, and each frame draws what a fresh paint of that frame would draw
- [x] #2 Selection, task, flow and comparison highlights stay on their elements through those motions without being re-applied on every frame, and task pins follow their elements
- [x] #3 The selection glow is hidden while the map moves (pan, zoom, view switch, orbit, settling world update) and returns once the map settles
- [x] #4 At rest, the glow no longer repaints the map SVG: the border lightening is removed (Alex's decision, 2026-09-23) and the halo alone breathes
- [x] #5 Surface titles switch to the size step of the settled zoom through the same painter; the separate title relayout path is removed
- [x] #6 While the painter animates a view change, the camera sets the map transform directly, so frames stay sharp and no extra full redraw follows the motion
- [x] #7 Social covers and static exports draw the same map as before
- [x] #8 The 500-surface limit for animated world updates is re-measured with the new painter and kept or removed based on that measurement
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
- [x] #5 Before and after frame measurements, taken with the 2026-09-23 procedure, are recorded on the task
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Final approach:
1. Shared drawing is data. svg.ts: read-only SvgNode and node() (replacing svgMarkup), markup() for covers, and patch() for the browser: it reuses children by data-id or id, otherwise the next one with the same tag and class, writes only attributes, class tokens and text that changed, leaves attributes and classes other code set, moves reused elements into order with one cursor walk, and reports whether elements were created or removed.
2. Painters return SvgNode arrays: paint-ground, paint-buildings, paint-routes, text, style.ts pattern tiles (their marks keep ordinary strokes), layers/paint. cover.ts serialises with markup(). layoutSurfaceLabels and the data-font-size/data-band-* attributes are removed.
3. iso/map.ts paint(scene) patches every layer. It returns true when highlights must be applied again: elements were created or removed, or the highlight inputs (route ids and ends, the surface under each body, compared as one JSON key) changed; only then are its item, route and surface indexes rebuilt. render.ts repaintScene calls paintMapState() only then, so highlight state keeps its one owner. A zoom that settles on another title step redraws only islands and slabs, where titles live.
4. Motion: an actual camera change or a repaint sets data-map-moving (hover waits, the glow hides) and arms one self-rearming settle timer; prepareCamera only promotes the cached layer. The settle (250 ms after the last motion) clears the flag and the repainted state, commits a changed zoom and shows the glows again. move() writes the camera into the SVG while a repaint is newer than the last commit; otherwise pan and zoom keep the cached-layer transform. The latest and committed cameras share one CameraView type.
5. Glow: iso/glow.ts owns the halo, a blurred silhouette on its own HTML layer that breathes by opacity, hides while the map moves and is rebuilt only when its outline changes. The border lightening is removed (Alex's decision), so at rest nothing repaints the map SVG.
6. render.ts reads the pane frame before painting; the hidden debug panel no longer refreshes on every repaint.
7. Measured before and after (see notes); world-update limit kept; web guide updated (only this task's hunks).
Tests: the rules at risk (reused elements draw what a fresh paint draws and keep highlights) are verified in the browser with objective scripts, because Bun tests have no DOM; the unidentified-container test uses markup(). No other new tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Measurement procedure (2026-09-23): Chrome via DevTools, 1440×806, DPR 2, 120 Hz. Static exports opened from file://; "before" = page and script built from HEAD e054322e, "after" = the same site data with page and script built from HEAD plus this task's diff (built in a detached worktree so other agents' uncommitted work stays out). Frame rate from requestAnimationFrame stamps; costs from performance traces.

Groma's map (111 buildings), view switches: before 86–92 fps with worst frames 33–42 ms; after 96–107 fps with worst frames about 17 ms. Pan and zoom stay at 120 fps with zero DOM work.
Callforpapers exported for comparison is small (129 buildings) and behaves like Groma's map.
Openclaw clone scanned into the scratchpad (3,164 buildings, 32,486 map nodes): before about 6 fps (130–290 ms frames), after about 7 fps (about 135–150 ms frames). Per frame about 70 ms is our JS (projection, node building, patching) and about 80 ms is the browser's style, layout and paint of 32k SVG elements; reusing nodes removes the HTML parse but not that browser work.
Glow with a component selected (Groma map): at rest the main thread goes from 11% to 0.5% busy and SVG paint from 67 ms to 0 per 900 ms; while panning from 17% to 8% busy and SVG paint from 80 ms to 11 ms.
Correctness: Iso→2D→Iso and Iso→Layers→Iso round trips reproduce a fresh paint (attribute and class order ignored); selection, the read-only pencil's hidden state and one glow survive; titles change step only after a zoom settles and only title attributes are written then; the camera keeps no CSS transform during a switch and its last SVG write lands at the end of the 850 ms switch. Covers for all three themes are identical to HEAD apart from the renamed motion flag, the outline dash selector and the removed title data attributes.
World-update limit: a big-map frame still costs about 135–150 ms with the new painter, so animating world updates above 500 surfaces would still stutter; MORPH_LIMIT stays.

Spec review against the acceptance criteria (evidence from the browser checks above):
- AC1: view switches, Layers orbit and world updates reuse the drawn elements; nothing is rebuilt per frame. Elements are still created or removed where the drawing itself gains or loses parts: side faces on the first frame back from 2D and on the last frame into 2D, layer planes on entering and leaving Layers, a shrinking or growing building's name lines at half size, and leaving buildings once a world update lands. Round trips through 2D and Layers reproduce a fresh paint. The wording "no map nodes after their first frame" is stricter than this; raised with Alex.
- AC2: selection, flow lighting (lit, focused step, on-path dimming), comparison marks and task-pin activation persist through switches and world updates; the map re-applies its stored highlights only to elements a repaint creates.
- AC3: the halo and outline are display:none while data-map-moving is set (pan, zoom, view switch, orbit, world update) and are rebuilt once when the map settles.
- AC4: the border lightening is an outline layer over the shape with an opacity pulse; its stroke matches the face (2.8 px measured); idle SVG paint with a selection is 0.
- AC5: titles change size step only after a zoom settles, through the painter; layoutSurfaceLabels and the data-font-size/data-band-* attributes are gone.
- AC6: no CSS camera transform during a switch; the last SVG camera write lands at the end of the switch.
- AC7: covers identical to HEAD apart from non-drawing CSS/attribute changes; exports use the same painter.
- AC8: limit kept (big-map frames still about 135–150 ms).
Checks: bun run check passes on HEAD plus this diff in an isolated worktree (Node 16/16, Bun 700 pass, 0 fail, 43 skipped; lint warnings are the 4 pre-existing ones).

Cold simplicity review (separate agent, no history) and its resolution:
- Defect: the glow's outline layer drew over everything, so hidden back edges of stepped towers and buildings behind taller ones showed at each pulse peak. Resolved by keeping the border pulse on the shape's own faces (depth order preserved), paused while the map moves; the outline layer is gone. Consequence: at rest the border pulse still repaints the map (AC4) — decision for Alex.
- Defect: highlights could go stale when a world update changed route bundling or the surface under a body without creating elements. paint() now returns true when elements, route ids and ends, or surfaces changed; render.ts re-applies paintMapState only then. The highlight registry in map.ts and the pin activation memory were removed (pins.ts back to HEAD).
- Defect: any click marked the map as moving and made the glow blink. Only an actual camera change or a repaint marks motion now; prepareCamera only promotes the cached layer. Verified: a click keeps the glow.
- Defect: the first pan after an idle repaint went through a full SVG commit. The settle clears the repainted state. Verified: that pan uses the cached layer with no SVG camera writes.
- Simplifications applied: longest-increasing-subsequence moves replaced by one cursor walk (no measured benefit); keyOf folded into matchOf; class handled once in writeAttributes; startup defs patch removed; names SETTLE_MS, scheduleSettle, reshaped. Kept, with evidence: the single self-rearming settle timer (clear-and-restart timers cost about 62 ms per second of switching in the profile; gone now).
- Also on the path: the hidden debug panel no longer rewrites its values on every repaint.
Final numbers (Groma's map): view switches 106–110 fps, worst frame about 17 ms (before 86–92 fps, 33–42 ms). bun run check passes on HEAD plus this diff (Node 16/16, Bun 700 pass, 0 fail).

Full-context review (general-purpose agent with a written brief; the fork agent type is not available here). Verdict: keep the node-reusing painter for what it deletes and unifies (one paint path, titles through it, highlights survive repaints), not for frame rate. It flagged that a zoom settle crossing a title step redrew all 7 layers; fixed: titles live only in islands and slabs, so drawSurfaces() redraws just those. Verified on Groma's map: titles hold during the zoom, all 24 change step after it settles, and only title attributes on islands and slabs are written.
Open for Alex: remove the border pulse (AC4 by deletion) or keep it; the reviewer's remaining recommendations (one JSON comparison of highlight inputs; paintMapState() without arguments, which also brings render.ts back under 500 lines, 502 now; glow into iso/glow.ts; glow mounted with patch; readonly SvgNode; collapse camera state; comment fix); AC1 rewording.
Follow-up outside this task: on historical revisions the edit pencil stays visible because paintProjectEdit sets hidden on an SVG group, which Chromium ignores (pre-existing; revision/control.ts has TASK-480.1's uncommitted edits).

Alex's decision (2026-09-23): remove the border lightening completely. Removed the map-highlight-border keyframes and the face selectors from style.ts and the three web-guide sentences about the border lightening; AC3 and AC4 reworded to that decision. Measured with a component selected at rest: main thread 0.3% busy and 0 ms SVG paint per 900 ms (before this task 11% and 67 ms); the border stays steady green, the halo still breathes, hides while panning and returns after.
render.ts is back to 500 lines (the paint result now guards the existing paintMapState call instead of adding an early return).
bun run check passes on HEAD plus the final diff (Node 16/16, Bun 700 pass, 0 fail; the 4 lint warnings are pre-existing).

Cleanup round (Alex approved the reviewer's remaining recommendations, 2026-09-23): SvgNode is read-only; the glow lives in iso/glow.ts (createGlows, mounted with patch, CSS beside it); map.ts keeps one CameraView for the latest and committed camera and compares highlight inputs as one JSON key; render.ts paintMapState() takes no arguments (500 lines); AC1 reworded to what the painter guarantees. Architecture: glow.ts is curated into the map component; the transient glow records the watcher created are gone, so they are dropped from this list.
Re-verified after the round on Groma's map: view switches 106–110 fps (Iso→Layers 90–93), worst frame under 18 ms; round trips equal a fresh paint with highlights kept; a click keeps the glow; the glow hides during switches, pans and world updates and returns after; at rest with a selection the map SVG takes 0 writes in 3 s while the glow breathes; titles change step after a zoom settles with writes only on islands and slabs; the first pan after a world update stays on the cached layer.
bun run check passes on HEAD plus this task's patch alone in an isolated worktree: Biome 551 files (4 pre-existing warnings, none in this task's files), types, Node 16/16, Bun 700 pass, 43 skip, 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web map now moves between Iso, 2D and Layers, orbits and settles world updates by patching its existing SVG elements instead of rebuilding every layer from HTML on each frame. Shared painters return SVG nodes: covers serialise them with markup(), and the browser draws them with patch(), which reuses elements by id or by tag and class and keeps the highlight classes other code set. Highlights are applied again only when a paint creates or removes elements or changes the highlight inputs. While a paint animates, the camera writes straight into the SVG; titles follow a settled zoom through the same painter, and the separate title relayout is gone. The selection glow lives in iso/glow.ts and hides while the map moves; the border lightening is removed (Alex's decision), so at rest nothing repaints the map SVG. Verified in Chrome on Groma's map: view switches at 106–110 fps with worst frames under 18 ms (before 86–92 fps and 33–42 ms); round trips reproduce a fresh paint with highlights kept; with a component selected, 0 SVG writes at rest (before 11% main thread and 67 ms of SVG paint per 900 ms); covers match HEAD. The 500-surface limit for animated world updates stays, because a 3,164-building map still costs about 135–150 ms per frame. bun run check passes on HEAD plus this task's patch (Node 16/16, Bun 700 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
