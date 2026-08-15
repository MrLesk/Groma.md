---
id: TASK-28.2
title: Navigate and inspect the fixed architecture world
status: Done
assignee:
  - '@tui-nav'
created_date: '2026-08-09 19:07'
updated_date: '2026-08-15 14:02'
labels: []
dependencies:
  - TASK-28.1
references:
  - groma/plans/mvp/README.md
  - docs/viewer.md
  - docs/product-model.md
  - groma/README.md
parent_task_id: TASK-28
priority: high
type: feature
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let the human architect navigate and inspect the fixed world entirely from the keyboard after starting `groma view`. System Context is the outer level. The selected system or container determines which direct children are framed when moving inward. Global zoom, spatial selection, popup details, and camera framing never alter world geometry.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The viewer starts at System Context with the first internal system in stable-ID order selected; the footer calls this compact level `context`
- [x] #2 `+` enters the selected internal system or container without opening details: a system frames only its containers and a container frames only its components; it is a no-op for people, external systems, components, or items without children
- [x] #3 `-` returns from Components to the container whose children were framed, or from Containers to the system whose children were framed, without opening or closing details; it is a no-op at System Context
- [x] #4 The footer continuously shows `- context | containers | components +` with the active level emphasized; `z` moves focus from the selected architecture item to this control, and pressing `z` again restores that item
- [x] #5 With architecture focus active and no popup open, an arrow selects the nearest same-level item in that direction across the whole world, including an item under another parent, before considering a higher-level item
- [x] #6 When no same-level item exists in the pressed direction, the arrow selects the nearest higher-level item outside the selected item ancestor chain and updates the level; arrows never descend and do nothing when no eligible destination exists
- [x] #7 Enter performs the same applicable inward transition as `+` and opens the selected item details in an overlay right-side panel; if no inward transition applies, it only opens details
- [x] #8 While the side panel is open, the camera fits as many direct children of the selected item as possible into the uncovered viewport without moving them or showing components from sibling containers
- [x] #9 The detail popup shows name, kind, annotation chips, description, relationships, direct children, and component Code references when present; `f` toggles between side-panel and full-screen modes, and full-screen hides the world
- [x] #10 Esc closes an open popup without changing level, selection, or geometry; Esc with no popup open exits Groma and restores the terminal
- [x] #11 The bordered header and one-line footer update after every selection, level, focus, popup, and full-screen transition so the current item, level, focus, and applicable keys remain visible
- [x] #12 Pressing R asks Groma core for the current world again and redraws it without exiting or changing level; the selected id stays when it still exists
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
- [x] #5 Unit tests exercise stable initial selection, inward and outward transitions, items without children, zoom-control focus restoration, same-parent movement, cross-parent movement, higher-level escape, ancestor exclusion, and no eligible destination
- [x] #6 Headless OpenTUI key sequences verify `+`, `-`, Enter, both `z` transitions, arrows, and unchanged world coordinates throughout
- [x] #7 Headless detail tests cover a person, internal and external systems, a container, and a component; direct-child and Code-reference content; side-panel camera framing; sibling-container exclusion; `f`; and the two-step Esc sequence
- [x] #8 Headless frames verify that side-panel mode overlays the world, full-screen mode hides it, and header/footer state and hints match every interaction state
- [x] #9 The focused navigation/detail suite and project check command pass
- [x] #10 A real-terminal walkthrough confirms selected-boundary drill-in, camera framing of a large container, zoom focus, cross-parent navigation, popup modes, and exit without a mouse
- [x] #11 A cold simplicity review explains the keypress-state-camera-render path and removes any state, key binding, abstraction, or test not required by these acceptance criteria
- [x] #12 Headless OpenTUI verifies that R reloads the world through core and redraws a changed architecture document
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep the viewer as a projection of `loadArchitectureViewModel` only. Put keyboard rules in a pure reducer (`navigation.ts`) so initial selection, `+`/`-`/Enter, arrows, `z`, `f`, and Esc-to-close can be unit-tested without OpenTUI or layout.
2. Start at System Context with the first internal system in architecture-ID order. `+` and Enter enter an internal system (Containers, that system's containers only) or container (Components, that container's components only) and keep that parent selected; no-op for people, external systems, components, and childless items. `-` returns to the framed parent and is a no-op at context. Enter also opens a right-side details overlay.
3. Arrows use fixed world centers: nearest same-level item in that half-plane, including other parents; if none, nearest higher-level item outside the ancestor chain and raise the level; never descend; no-op when nothing qualifies. Arrows apply only with architecture focus and a closed popup. `z` toggles focus onto the footer level control and back to the same item.
4. Details (organism) show name, kind, origin chip, description, relationships, children, and component `code`. `f` toggles side vs full-screen. Side panel shrinks the uncovered viewport and cameras the selected item's children without moving world geometry or showing sibling-container components. Full-screen hides the world. Esc closes the popup only; Esc with no popup still exits.
5. Header and one-line footer update on every state: keep `- context | containers | components +`, emphasize the active level (or the whole control when `z` is focused), and show applicable `z`/`f`/`R`/`Esc` hints. Extend existing Bun headless tests; do not add scan, accept, watcher, 1-4, q, ?, Code level, or product-doc layout prose.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
R refresh shipped ahead of the rest of TASK-28.2.

`groma view` keeps the repository root and pressing R (or `refresh()`) asks `loadArchitectureViewModel` again, then redraws. Level and selected id stay unless they disappear from the new world. A failed reload keeps the previous world. Footer hint is `R refresh`.

Verification: `bun test test-bun/terminal-viewer.test.ts` 6/6, including a temp-copy fixture whose `# Legacy ordering` heading became `# Legacy queue` after R while remaining on `Components · …`.

Keypress path: terminal-viewer maps + - Enter arrows z f Esc to reduceViewer, then projectWorld (side panel shrinks the uncovered viewport and cameras the selected item's children), then paintWorld draws the world, overlay details, and chrome. World geometry is never written.

Cold simplicity review: entry is keypress, work is one reducer plus projection camera, result is header/world/details/footer. Shared ancestorOfKind; removed unused C4Kind import and a duplicate release check. No extra modes, 1-4, q, ?, Code level, breadcrumb, or watcher. Footer hint strings stay in chrome so tests and paint use the same source.

Verification:
- bun test test-bun/terminal-viewer.test.ts 9/9
- bun run check: tsc 7.0.2, architecture validate, 85/85 Node, 9/9 Bun
- tmux 120x36 `bun src/cli.ts view`: System Context · Groma; + → Containers · Groma; Right → Core; Enter → Components · Core side panel with children framed left; f full hides world; f side; Esc close; z item / z zoom; Down → Architecture model; Left → Terminal interface; Esc exits to the shell

AC evidence is in those tests and the tmux captures, not grep.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-08-15 12:45
---
R refresh is being added now as the manual reload until a file watcher exists. The rest of this task stays To Do.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Keyboard navigation and details for the fixed-world TUI. `groma view` still asks core for one world; + - Enter arrows z f Esc change only viewer state and camera. Verified by bun test test-bun/terminal-viewer.test.ts 9/9, bun run check, and a tmux 120x36 walkthrough of drill-in, Core framing, zoom focus, Architecture model → Terminal interface, side/full details, and Esc exit.
<!-- SECTION:FINAL_SUMMARY:END -->
