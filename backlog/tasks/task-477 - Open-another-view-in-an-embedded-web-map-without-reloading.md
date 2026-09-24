---
id: TASK-477
title: Open another view in an embedded web map without reloading
status: Done
assignee:
  - '@claude'
created_date: '2026-09-21 17:55'
updated_date: '2026-09-24 16:22'
labels: []
dependencies: []
references:
  - render
  - shell
  - camera
modified_files:
  - src/viewers/web/embedding.ts
  - src/viewers/web/chrome/shell.ts
  - src/viewers/web/render.ts
  - src/viewers/web/iso/pointer.ts
  - test-bun/web-embedding.test.ts
  - docs/viewers/web/index.md
  - groma/relationships.md
  - groma/systems/groma-md/containers/export/components/render.md
ordinal: 553000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex presents Groma with the live web map embedded in an iframe inside his slides. Each slide click must show another view (a component, a flow step, a task). The only way to do that today is to change the iframe URL, which reloads the whole page and cuts the camera. Stacking one preloaded iframe per view is not possible either, because every page holds a live /events stream and browsers cap connections per origin. The map already restores a complete view from its query string at startup; an embedding page needs the same result while the map is open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A page that embeds the web map can post a query string to it, and the map opens that selection, flow step, task, details tab, and HUD state without reloading
- [x] #2 The camera animates to the opened view the way it does for the same selection made in the map
- [x] #3 An embedded map announces when it can take views, so the embedding page knows when to start
- [x] #4 Only the parent window of an embedded map can open views; a map opened directly is unaffected
- [x] #5 The web viewer guide documents the message next to the URL parameters
- [x] #6 A posted view can also open a component source file at a line, as the file and line URL parameters do
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
1. Add src/viewers/web/embedding.ts: listenForEmbeddedViews(page, openView) does nothing unless the page has a parent window, accepts { gromaView: '<query string>' } only from that parent, and posts { gromaReady: true } to it once listening.
2. In src/viewers/web/render.ts add openView(search): read the query with readView exactly as startup does, replace selection, flows, active task, details tab and HUD state, repaint, then focus the camera the same way the matching in-map selection does (task, flow step, architecture, or refit when empty).
3. Keep render.ts within the 500 line rule by moving its page host lookups into chrome/shell.ts, which already owns the page chrome.
4. Cover embedding.ts in test-bun/web-embedding.test.ts with a plain window object, matching the existing pure web tests.
5. Document the message next to the URL parameters in docs/viewers/web/index.md.
6. Run bun run check and verify in a browser with an embedding page that posts views.

7. Move the wheel listener into iso/pointer.ts, where bindMapPointer reports wheel steps through a wheel action, so render.ts stays within 500 lines.

8. On Alex's request, let a posted view also open a source file at a line, as the file and line URL parameters do.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: src/viewers/web/embedding.ts listens only when the page has a parent window, accepts { gromaView: string } from that parent, and posts { gromaReady: true }. render.ts openView(search) reads the query with readView as startup does, replaces selection, flows, active task, details tab and HUD, repaints, then focusOpened() frames it (task, architecture, flow step, or refit when the view names no selection). Startup now uses the same focusOpened() helper; an unselected startup calls refit(), which leaves the already fitted camera where it is. Theme and revision are not changed by a posted view.

To stay within the 500 line rule render.ts (499 lines, unchanged count) gave up two blocks to their owners: the page host lookups moved to chrome/shell.ts as pageHosts(), and the wheel listener moved into iso/pointer.ts, where bindMapPointer(host, map, actions) now reports wheel steps through a wheel(action, point) action. Behaviour of both is unchanged.

Architecture: the scanner recorded embedding.ts as a new component. It shares the Browser session responsibility, so it was combined into render with groma edit (parent export, then --combine).

Verification: bun run check passes (635 pass, 36 skip, 0 fail; lint and typecheck clean). test-bun/web-embedding.test.ts covers announce, open, ignored senders, ignored non-views, and a directly opened map. Browser check with the Slidev deck in mrlesk.com/talks/groma/flash: five slide clicks moved the embedded map through container, component, tab=how, flow step and task while the iframe src never changed, and the map's own URL followed each posted view. Wheel pan and zoom were not re-tested by hand after the move into pointer.ts.

Wheel input re-verified in a browser after the move into pointer.ts: a plain wheel pans the map at 100%, and Ctrl plus wheel zooms about the cursor (100% to 2009%).

Scope added on Alex's request to bring the embedded map into his Devoxx deck: a posted view also opens source (file and line), so render.ts is now exactly 500 lines. Documented in the web viewer guide.

After adding file and line to posted views: bun run check passes again (635 pass, 36 skip, 0 fail). Browser check in the Devoxx deck (mrlesk.com/talks/devoxx/in-the-loop): a posted view with file=src/viewers/web/server.ts and line=19 opened the source reader, and the map URL followed it.

Finalized on 2026-09-24 after the code landed in e5269cee. Re-verified on main b30b74f2 in a clean worktree: bun test test-bun/web-embedding.test.ts test-bun/web-sheet-morph.test.ts, 11 pass, 0 fail. render.ts openView on main still opens file and line (source.open(next.file, next.line)); the guide documents gromaView and gromaReady next to the URL parameters.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-09-21 21:13
---
TASK-479 coordination: I am changing iso/map.ts, iso/style.ts and only the component/flow glow paragraphs in docs/viewers/web/index.md. Your recorded code files and embedding documentation stay untouched. I will stage only TASK-479 hunks; please preserve its glow paragraphs in the shared guide.
---

author: @claude
created: 2026-09-22 20:29
---
TASK-484 coordination (touch pinch): I change only the pointerdown/move/up/cancel handlers in iso/pointer.ts, below your wheel listener, and the gesture sentence under What you can do in docs/viewers/web/index.md. Your lines stay untouched. TASK-484 uses your host parameter and wheel action, so it commits after TASK-477. Please stage only TASK-477 hunks in those two files.
---

author: @claude
created: 2026-09-22 21:14
---
Committed as e5269cee on Alex's request: the task record, embedding.ts and its test, the wheel move in iso/pointer.ts, pageHosts in chrome/shell.ts, render.ts, the render.md curation, and the embedding paragraph of the web guide. The pointer.ts to render.ts derived row in groma/relationships.md now also reflects TASK-484, so it ships with TASK-484. Status left for the owner to finalize.
---

author: @claude
created: 2026-09-23 19:03
---
TASK-497 coordination: I add one map.dragging(true/false) call to the drag pointermove, pointerup and pointercancel handlers in iso/pointer.ts (and a dragging stub in test-bun/web-map-pointer.test.ts). Your committed wheel and embedding lines stay untouched.
---

author: @claude
created: 2026-09-23 20:10
---
TASK-498 coordination: I extend the drag handlers in iso/pointer.ts (release speed for a glide), add a glide action in render.ts and one sentence about the glide under What you can do in docs/viewers/web/index.md. Your committed lines stay untouched.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A page that embeds the live web map in an iframe can now open another view without reloading. embedding.ts listens only to the parent window, accepts { gromaView: '<query string>' }, and announces { gromaReady: true }; render.ts openView reads the query exactly as startup does, so selection, flow step, task, details tab, HUD and a source file at a line open with the same camera move as the matching in-map selection. A map opened directly ignores messages. Verified with test-bun/web-embedding.test.ts (announce, open, ignored senders, ignored non-views, direct map), bun run check, and browser checks in the Slidev and Devoxx decks where slide clicks moved the embedded map through container, component, tab, flow step, task and source while the iframe src never changed.
<!-- SECTION:FINAL_SUMMARY:END -->
