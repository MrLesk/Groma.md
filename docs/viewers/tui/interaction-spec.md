# TUI interaction review examples

Approved refinements for TASK-244. The durable behaviour is described in the
[Terminal viewer guide](index.md); the Terminal Facelift examples establish its
root and container views. Human understanding of architecture, relationships
and flows takes priority.

When an architect opens `groma view`, they can follow architecture and work
without losing their place. Web and TUI share meaning and work data, not geometry.

## Pane focus and reading

`t` opens and focuses the hierarchy; `d` opens and focuses details. Pressing the
key for the already focused pane folds it and returns to the map. Arrows stay
inside the focused pane. `Tab` changes the available details tabs. `Escape`
returns to the map with the same architecture selection and scope; inside a
source file or diff it first returns to the preceding details or task record.

Element details and the hierarchy list authored **Flows** and open the same
single-flow reader. Standing collaborations remain **Relationships**.

In task status groups, Enter expands or collapses and Space changes map
visibility only in the hierarchy. The component Tasks tab can browse, fold and
open records without changing map visibility. One centered, bordered Backlog
recap sits beneath the map, outside its canvas.

An open task keeps its wide pane across focus changes when the hierarchy and a
readable map also fit. Task records, source and diffs share a reading layout with up to 80 text
columns. On narrow terminals the reading pane uses the available width instead
of keeping an unreadable map beside it. Closing it restores the normal layout.
Reading every record row and returning from a file preserve the reading position.

Neighbouring containers appear only as narrow edge strips. Their names read
vertically at the left/right and horizontally above/below. The active container
uses most of the map viewport; empty neighbouring interiors never take half of it.

Use the real project at 120x36 and 200x60, then shrink an open view to 80x30:

1. Open root, enter a container, navigate all four directions, and return.
2. Move through central and edge cards. The camera follows within the displayed
   map bounds. Cards, groups, routes and labels keep their world positions.
3. Verify rectangle proximity: B is just right of A and overlaps its bottom by
   one terminal row; C is farther right. Right from A selects B.
4. Move between map, hierarchy and details using explicit keys. Architecture
   selection remains green; pane focus and bracketed footer actions remain clear.
5. From inside a container, browse flow rows without changing scope. Space or
   Enter opens a flow's purpose and ordered steps. Step it, inspect both endpoint
   directions, and return with Escape. The same step remains selected; unrelated
   connections stay hidden. Clear it and confirm that map geometry stayed fixed.
6. Open Work and a component Tasks tab. Both group tasks by status and show titles and
   pie progress beside exact checklist counts, open the same record, and highlight the task's architecture. Open a
   modified-file diff and an architecture reference. Closing Work restores the
   saved architecture view.
   Confirm To Do comes first and starts folded and map-hidden; In Progress is
   expanded and Done folded. Enter folds or opens a header without changing map
   visibility; Space changes visibility only in the hierarchy. A folded task cannot
   keep the cursor. Records show definition before execution, and their reading
   cursor reaches notes and comments after the last link. A diff returns to the
   exact record row.
7. Fold panes and resize. Keep a readable map and access to selection details.
   Read a record and a source file at 80 text columns on a wide terminal and at
   the available width on a narrow one, then return to the normal map layout.
8. Distinguish systems, containers, groups and components using shape, frame
   weight, spacing and glyphs. Every surface is plain. Solid versus dashed lines
   indicate origin, including group frames.

9. Compare task file facts and their opened diffs: file status and line totals
   come from the same snapshot, wrapped file rows open the exact path, and old/new
   line gutters separate additions and removals. Check syntax and change colors
   in light and dark terminal palettes.
10. Open Advanced commands and Instructions from the launcher. Tab switches
   between list and reading focus. Arrows scroll content only in reading focus;
   j/k and page keys still scroll. Tab back restores command or guide navigation.
   The launcher keeps normal action selection without a reading mode.

Keep one checked flow and one active task; do not add preview confirmation,
multiple task selection or floating panels.

Compare actual screenshots and interactions with these examples. Use `tui-test`
for repeatable checks and a native terminal for font, theme and motion confirmation
when available. Passing tests alone is not visual acceptance.

Explicit flow membership appears under What in the Flows list.
How contains technology and code, with declaration navigation in visible order.
