# TUI map validation

The TUI world is a map inside fixed chrome: a one-row header, a
hierarchy pane, the map pane, a details pane, and a one-row footer,
with one blank row above the header and below the footer.
Panes reserve width; they never overlay the map. Selection never changes the
world layout; available-width changes may wrap cards and rows. The map uses one fixed,
readable scale. A larger terminal reveals more canvas; there is no
geometric zoom or fit-all view.

- The details pane shows the current architecture selection, except while an
  explicitly focused flow, work record, source, diff, profile or help view is open.
- The root map shows actor, system and external-system islands, with container
  rows and miniature component blocks. It does not show groups or component cards.
- Enter opens only a container, showing that container, its groups and
  components. Backspace returns to root. Arrows never change scope.
- Arrowing selects the nearest eligible card by its rectangle, including slight
  overlap. Map arrows never move pane focus. The camera follows toward the
  selection, bounded by the displayed map, with no empty space beyond its edges.
- Cards, routes, and relationship labels keep their world cells across selection
  changes. Only their camera position changes.

Drive `groma view` with `tui-test`. Read the terminal, send keys, and
capture a screenshot.
Compare world geometry across arrow moves; the camera may pan, but cards and
labels must not rearrange. Do not wait for a human screenshot.

```bash
GROMA_TUI_SESSION="groma-view-$$"
GROMA_TUI_ARTIFACTS=$(mktemp -d /tmp/groma-tui-test.XXXXXX)
trap 'tui-test close --session "$GROMA_TUI_SESSION" >/dev/null 2>&1 || true' EXIT
tui-test run --session "$GROMA_TUI_SESSION" --cols 120 --rows 36 --cwd "$PWD" bun src/cli.ts view
tui-test wait idle --session "$GROMA_TUI_SESSION" --timeout 10000
tui-test text --session "$GROMA_TUI_SESSION"
tui-test press --session "$GROMA_TUI_SESSION" Enter
tui-test wait idle --session "$GROMA_TUI_SESSION" --timeout 10000
tui-test screenshot --session "$GROMA_TUI_SESSION" "$GROMA_TUI_ARTIFACTS/frame.svg"
tui-test close --session "$GROMA_TUI_SESSION"
trap - EXIT
```

Look at the root view, details, a container, and a large size such as 200x60.

