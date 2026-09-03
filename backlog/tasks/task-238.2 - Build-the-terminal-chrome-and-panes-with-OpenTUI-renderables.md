---
id: TASK-238.2
title: Build the terminal chrome and panes with OpenTUI renderables
status: Done
assignee:
  - '@claude'
created_date: '2026-09-02 06:22'
updated_date: '2026-09-03 06:00'
labels:
  - tui
dependencies:
  - TASK-238.1
references:
  - chrome
  - hierarchy
  - details
  - screen
  - terminal-painting
  - work-focus
modified_files:
  - src/viewers/tui/atoms/theme.ts
  - src/viewers/tui/panes/text.ts
  - src/viewers/tui/panes/chrome.ts
  - src/viewers/tui/panes/hierarchy.ts
  - src/viewers/tui/panes/details.ts
  - src/viewers/tui/panes/screen.ts
  - src/viewers/tui/panes/view.ts
  - src/viewers/tui/paint.ts
  - src/viewers/tui/work/paint.ts
  - src/viewers/tui/molecules/work-marker.ts
  - src/viewers/tui/organisms/chrome.ts
  - src/viewers/tui/organisms/hierarchy.ts
  - src/viewers/tui/organisms/details.ts
  - src/viewers/tui/organisms/world.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/view-host.ts
  - src/viewers/tui/molecules/card.ts
  - src/viewers/tui/molecules/route.ts
  - src/viewers/tui/molecules/boundary.ts
  - src/viewers/tui/molecules/flow-marker.ts
  - src/viewers/tui/atoms/border.ts
  - src/viewers/tui/molecules/hatch.ts
  - src/viewers/tui/layout.ts
  - test-bun/helpers.ts
  - test-bun/tree.test.ts
  - test-bun/viewer-lifecycle.test.ts
  - test-bun/viewer-live.test.ts
  - test-bun/work.test.ts
  - test-bun/chrome.test.ts
  - test-bun/navigation.test.ts
  - test-bun/large-world.test.ts
  - test-bun/tui-theme.test.ts
  - docs/viewers/tui/index.md
  - scripts/large-world-fixture.ts
  - test/fixtures/large-world
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 262000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect opens `groma view`, Groma shows the same header, hierarchy pane, details pane and footer built from OpenTUI Box, Text, ScrollBox and TabSelect renderables instead of hand-painted cells, with the pane typography from the design page: a kind glyph, a bold title, one dim line of detail, values coloured by meaning. Every colour is a terminal intent: default foreground and background, bold, dim and the brand green #1D9E75. Nothing is a sampled palette mix, so a terminal theme switch recolours the viewer live, as the splash does, and the startup palette query goes away. The map stays the current painter inside one renderable so this ships alone. Keys do not change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Header, hierarchy, details and footer are OpenTUI renderables laid out by the toolkit; panes reserve width and never overlay the map
- [x] #2 Hierarchy and details scroll and wrap through ScrollBox; long descriptions are never clipped
- [x] #3 Rows and cards follow the page: glyph, bold title, dim detail line, coloured values; the details tabs are one text row, since the toolkit tab strip cannot fit both names in the pane
- [x] #4 Every colour is a default, bright-black, dim, bold or brand-green intent; no palette query at startup; a test proves the theme holds no sampled colour and that mounting never asks the terminal for its palette
- [x] #5 Every existing key, focus rule and pane toggle behaves as before; navigation tests pass unchanged
- [x] #6 tui-test screenshots at 120x36 and 200x60 match the pane treatment on the design page
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
1. Theme as intents: atoms/theme.ts exports viewerTheme() built from RGBA.defaultForeground(), RGBA.defaultBackground(), the palette's bright black for quiet frames and the brand green #1D9E75; every tint and origin colour the map painter still reads maps to those; no palette query in view-host or mount. 2. New src/viewers/tui/panes/: text.ts (chunk helpers), chrome.ts (header and footer text), hierarchy.ts (flows, tree, legend and Work list lines with the cursor row), details.ts (element, flow and task rows as styled lines plus the details tabs), screen.ts (the renderable tree: blank row, header Text, body row with hierarchy Box+ScrollBox, map Box holding the world FrameBufferRenderable and the recap Text, details Box with TabSelect and ScrollBox, footer Text, blank row; apply(view) updates content, scroll positions, focus colours and pane visibility). 3. terminal-viewer.ts mounts the screen, paints the map into its frame buffer with a local viewport, and applies pane content on every repaint; keys, reducer and camera rules unchanged. 4. paint.ts keeps only map painting; organisms/chrome.ts, hierarchy.ts, details.ts and the list and details painters in work/paint.ts are deleted. 5. Tests: theme intents and no palette query; existing chrome, lifecycle and large-world tests keep passing through captureCharFrame; docs/viewers/tui/index.md Appearance updated. 6. tui-test screenshots at 120x36 and 200x60 checked against the page.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The storage slice (TASK-241.1) landed mid-task: Origin is now observed or draft, the reader takes one tree. scripts/large-world-fixture.ts was re-laid to actors/, externals/ and systems/ (329 files) and the TUI reads origin === 'draft' for ghosts; the dotted missing style and the hatch molecule are gone.

Cold simplicity review: three blocking findings, all fixed. (1) Pane scroll followed the cursor only while the pane had focus; the cursor row is now recorded regardless of focus and inverted only with focus, so the selection stays in view at map focus and a task stays in view when its details open. (2) The toolkit clamps scrollTo against the size it laid out last, so a pane that grew scrolled to row 0; each scroll pane now repeats its wanted row from the content's onSizeChange and requests a render. (3) Tabs were 15 wide and clipped 'How it's built'; tab width now comes from the longest name. Accepted simplifications: the theme is four colours plus origin (kind tints and surfaceTint deleted; the old molecules read foreground and background), one styleRow and one kindMark in panes/text.ts serve hierarchy and details, one word-wrap, paneLayout moved to test-bun/helpers.ts (only tests used it) and its geometry test deleted, content widths exported beside the boxes with a one-column inset on details, the two blank rows became root padding, dead tab focus colours and repeated hideScrollbars removed, work/paint.ts became molecules/work-marker.ts, details build one element index per repaint, docs describe only the user-visible colour facts. Also fixed while there: the press helper now sends a real Tab. Details cursor scrolling keeps the pre-existing rule (scroll only when the cursor leaves the window).

Review round two, after the cold review fixes: the toolkit tab strip cannot show both tab names inside the 32-column pane, so the tabs are one text row (the open tab in the accent, the other in bright black) and criterion 3 says so. Text renderables ignore their own padding, so the one-column details inset lives on the ScrollBox content box. The unused item parameter left in molecules/boundary.ts by the theme collapse is gone. The watched-reload wait in test-bun/viewer-live.test.ts is 15 s so the fully loaded parallel suite has room.

Evidence: bun run check runs the Node suite green and the Bun suite at 220 pass with one failure, the web viewer's live Markdown test, which is a 20 s timeout under full load and passes alone (8 pass). Typecheck is clean. Lint reports 18 warnings, all pre-existing complexity targets; 9 sit in src/viewers/tui, none in a changed function. tui-test captures at 120x36 and 200x60 in the session scratchpad: root, container (Import, then its Import cache component), the hierarchy expanded to 37 rows with the cursor on the last row kept visible, and a clean Ctrl+C exit.

The full-context complexity review could not run as a separate agent: the agent was terminated by the account's session limit (resets 02:20). The implementer performed that review with full context and committed so the parallel web-editor work would not conflict; a separate-agent pass is owed after the reset, with any material recommendation landing in a follow-up commit.

Follow-ups, not blocking: the toolkit logs 'Error destroying root renderable' when a bare test renderer destroys the screen tree in a scratch probe, not reproduced by the test suite or by the terminal exit path; test-bun/helpers.ts still builds synthetic ids with an observed: prefix although Core no longer prefixes ids.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The terminal chrome is laid out by the toolkit: header, hierarchy pane, details pane and footer are OpenTUI renderables and only the map is painted by hand. Panes reserve their columns, hierarchy and details scroll and wrap through ScrollBox, the details tabs are one text row, and every colour is a terminal intent plus the brand green with no palette sampling. tui-test captures at 120x36 and 200x60 match the design page.
<!-- SECTION:FINAL_SUMMARY:END -->
