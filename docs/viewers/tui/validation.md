# TUI map validation

The TUI world is a map inside fixed chrome: a one-row header, a
hierarchy pane, the map pane, a details pane, and a one-row footer,
with one blank row above the header and below the footer.
Panes reserve width; they never overlay the map.

## Text map

The following invariants apply to `groma view --graphics text`. Selection never changes the
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

The automated terminal procedure requires `tui-test` on `PATH` in the
shell running it, plus Bun and the installed project dependencies.
Check availability with `Get-Command tui-test` in PowerShell or
`command -v tui-test` in Bash. It is a separate validation tool, not
a dependency required to run Groma.

Drive `groma view` with `tui-test`. Read the terminal, send keys, and
capture a screenshot.
Compare world geometry across arrow moves; the camera may pan, but cards and
labels must not rearrange. Do not wait for a human screenshot.

### Windows (PowerShell)

```powershell
$gromaTuiSession = "groma-view-$PID"
$gromaTuiArtifacts = Join-Path ([System.IO.Path]::GetTempPath()) ("groma-tui-test-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $gromaTuiArtifacts | Out-Null
try {
    tui-test run --session $gromaTuiSession --cols 120 --rows 36 --cwd (Get-Location).Path bun src/cli.ts view --graphics text
    tui-test wait idle --session $gromaTuiSession --timeout 10000
    tui-test text --session $gromaTuiSession
    tui-test key press --session $gromaTuiSession Enter
    tui-test wait idle --session $gromaTuiSession --timeout 10000
    tui-test screenshot --session $gromaTuiSession (Join-Path $gromaTuiArtifacts 'frame.svg')
} finally {
    tui-test close --session $gromaTuiSession
}
```

### macOS and Linux (Bash)

```bash
GROMA_TUI_SESSION="groma-view-$$"
GROMA_TUI_ARTIFACTS=$(mktemp -d /tmp/groma-tui-test.XXXXXX)
trap 'tui-test close --session "$GROMA_TUI_SESSION" >/dev/null 2>&1 || true' EXIT
tui-test run --session "$GROMA_TUI_SESSION" --cols 120 --rows 36 --cwd "$PWD" bun src/cli.ts view --graphics text
tui-test wait idle --session "$GROMA_TUI_SESSION" --timeout 10000
tui-test text --session "$GROMA_TUI_SESSION"
tui-test key press --session "$GROMA_TUI_SESSION" Enter
tui-test wait idle --session "$GROMA_TUI_SESSION" --timeout 10000
tui-test screenshot --session "$GROMA_TUI_SESSION" "$GROMA_TUI_ARTIFACTS/frame.svg"
tui-test close --session "$GROMA_TUI_SESSION"
trap - EXIT
```

Look at the root view, details, a container, and a large size such as 200x60.


## Graphical map

Use a disposable Git checkout of `test/fixtures/viewer-view` so the real `view`
command can scan and watch without modifying a fixture. Initialize Git and
commit the copied fixture before launching. Use an absolute CLI or binary path
when the working directory is that checkout.

```bash
tui-test run --session groma-pixels --cols 200 --rows 60 --cwd "$FIXTURE_COPY" bun "$GROMA_SOURCE/src/cli.ts" view --graphics blocks
tui-test wait idle --session groma-pixels --timeout 10000
tui-test key press --session groma-pixels Enter
tui-test expect text --session groma-pixels 'Shop › Api' --timeout 10000
# Allow the asynchronous raster to settle as well as the text panes.
sleep 0.4
tui-test screenshot --session groma-pixels "$ARTIFACTS/container.svg"
tui-test key press --session groma-pixels Shift+Right + f v
tui-test expect text --session groma-pixels 'Map · 2D' --timeout 10000
tui-test mouse move --session groma-pixels 105 30
# In tui-test 0.1.0-beta.3, `mouse scroll` sends at column/row 1,1.
# Send the actual SGR wheel report at the map pointer instead.
tui-test write --session groma-pixels $'\e[<64;109;30M'
tui-test mouse drag --session groma-pixels 105 30 110 32
tui-test key press --session groma-pixels Backspace g
tui-test resize --session groma-pixels 120 36
tui-test key press --session groma-pixels g
tui-test key press --session groma-pixels Ctrl+c
tui-test wait exit --session groma-pixels --timeout 10000
tui-test close --session groma-pixels
```

Repeat with a standalone binary outside the dependency directory. For the
high-resolution transport, run the same interaction in a supporting terminal
with `--graphics kitty` or `--graphics sixel` and inspect image placement,
clipping, resize, cleanup, and text-pane input. A blocks capture does not prove
those transports' visual correctness. See [verification limits](graphics.md#verification).
