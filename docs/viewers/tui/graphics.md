# Graphical terminal map

`groma view` uses terminal graphics when OpenTUI detects a usable Kitty or Sixel
image protocol. Otherwise it uses the readable text map. The hierarchy, details,
search, history, and source reader remain ordinary terminal text.

The graphical map is always a flat, axis-aligned 2D plan with horizontal labels.
There is no isometric mode, rotation, or view toggle.

```sh
bun src/cli.ts view
bun src/cli.ts view --graphics text
bun src/cli.ts view --graphics kitty
bun src/cli.ts view --graphics sixel
bun src/cli.ts view --graphics blocks
```

`blocks` explicitly previews the raster in character cells. It is much lower
resolution than Kitty or Sixel, and is not the automatic fallback. Sixel needs
terminal pixel dimensions. Automatic selection inside tmux stays in text mode;
an explicit protocol requires the terminal and multiplexer to pass it through.
The map title reports 2D and the output protocol.

## Keyboard first

Camera shortcuts act only while the map has focus. Search and reading panes keep
their existing keys. `Esc` returns from a reading pane to map navigation.

| Key | Action |
| --- | --- |
| Arrows; `j` / `k` | Select by the displayed geometry; down / up |
| `[` / `]` | Previous / next eligible element, including spatially isolated elements |
| `Enter` | Open a container; on a component, inspect its details |
| `Backspace` | Return to the root scope |
| `Shift` + arrows | Pan without changing selection |
| `+` or `=` / `-` | Zoom in / out |
| `0` or `Home` | Fit the whole architecture |
| `f` | Fit the selected element |
| `g` | Switch graphical / text rendering |
| `/`, `t`, `d`, `?` | Search, hierarchy, details, help |
| `Ctrl+C` | Exit |

Root navigation selects actors, systems, and containers. Entering a container
fits its components; the surrounding sheet remains present rather than being
relaid out. Component-level arrows may reach components in a neighboring
container without switching back to root. Selection reveals an offscreen target
without changing the current zoom. `f` provides a deliberate close-up.

## Mouse

Left-click selects the same elements the keyboard can select at the current
level. Drag with the left button to pan; releasing a drag does not select an
element. Wheel up/down zooms around the pointer. Mouse input is optional.

Hit testing uses the actual projected faces and the camera of the displayed
frame, not rectangular boxes or the camera of an unfinished render. Coordinates
are terminal-cell based, so very small targets are easier to reach with the
keyboard or after zooming.

## Rendering boundary

The terminal projects the shared sheet through the web viewer's pure
`projectScene` geometry at a fixed top-down orientation. Only flat top surfaces
are drawn; labels follow the horizontal screen axis. It serializes a self-contained SVG and
rasterizes it asynchronously with native `@resvg/resvg-js`, then passes RGBA pixels
to OpenTUI. It does not launch a browser or a game engine. This implementation
uses native resvg, not the WASM backend. Fonts come from the host system. A cached
font choice loads one common installed UI font (Segoe UI, Arial, DejaVu Sans, or
Liberation Sans) instead of rediscovering every system font on each frame. Hosts
without those files use resvg's system-font discovery. Glyph coverage follows the
chosen font; the text panes remain available for labels it cannot display.

The 2D view flattens a copy of the full building footprints; it does not change
source measurements, C4 ownership, or the composed sheet layout. OKF Markdown
and the existing C4 identities remain authoritative. No stored architecture
format or scanner interpretation changes.

One raster may run at a time, with one replaceable pending frame. A 40 ms input
coalescing interval avoids rendering every pointer event. Raster dimensions are
limited to 1600 by 1000 and 1.2 million pixels, preserving cell aspect ratio.
Unchanged frames do not rasterize. Resizing, switching output, and shutdown
invalidate obsolete frames and release their image references.

Flow relationships are highlighted without an idle animation loop. Work mode
uses the existing text map so its task overlays remain available. Exploded layers
are not part of this prototype. The graphical palette is fixed and neutral; the
surrounding text panes keep their terminal theme. A rasterizer failure returns
to text with a graphics-error caption; `g` retries graphical output.

## Verification

`test-bun/tui-graphics.test.ts` covers capability selection, pixel limits, camera
invariants, actual-face hit testing, immutable shared geometry, keyboard scope
and camera commands, mouse selection/drag/wheel, search ownership, idle behavior,
resize, and pending-render shutdown. It includes a regression for resvg's native
panic with offscreen SVG arrow markers: route arrows use explicit geometry.

On Linux with Bun 1.4.1, the repository check, standalone build, and standard
compiled smoke test pass. `tui-test` 0.1.0-beta.3 exercised the actual `groma view`
entry point in source mode and in a standalone binary copied away from
`node_modules`, against a disposable Git checkout of `test/fixtures/viewer-view`.
Captures cover root, container, drag, wheel, output switching, and 120x36 /
200x60 sizes. Both sessions exited with code 0 on Ctrl+C. A separate compiled-session check
asserted changed map cells after mouse selection, wheel zoom, drag, and keyboard
pan. The tester's `mouse scroll` sent `ESC[<64;1;1M` regardless of the last mouse
move; that check sent the equivalent SGR report at the map's actual pointer
coordinates. This is a validation-tool limitation, not a graphics input override
in Groma.

Those PTY captures use explicit `blocks` output. They verify the interactive
pipeline and native binary packaging, not high-resolution display in a physical
Kitty, Ghostty, or Sixel terminal. Those terminals, SSH, and tmux passthrough need
separate visual verification; protocol support must not be read as certification
of every host combination.

The 2D-only refinement passes the same 476 repository tests and Linux compiled
build/smoke checks. A copied standalone binary was exercised through `tui-test`:
Down/Up selected lower/upper components, `v` left the map unchanged, mouse click
selected a component, wheel and drag changed the camera, Shift+Right preserved
selection, graphical/text switching returned to 2D, and resize retained 2D.
