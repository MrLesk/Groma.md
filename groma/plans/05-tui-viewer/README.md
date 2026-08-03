# Revision 05 — Terminal viewer

## Outcome

When a human architect runs the Groma terminal viewer, Groma presents the same
fixed, nested C4 world the web viewer shows, navigated entirely from
the keyboard across the four pre-configured levels — Context, Containers,
Components, and Code. The terminal's own theme supplies every color; the
architecture, not the camera, is what the keys operate on.

The interaction was designed and confirmed by the human architect on
2026-08-01 through a live OpenTUI spike. Its design learnings and verified
library evidence remain in the
[historical OpenTUI investigation](../../../docs/historical-investigations.md#opentui-viewer)
on branch `spike/groma-tui` at commit `8b786ed`. The branch is evidence only
and must never be merged; production work is built fresh from this plan.

## Approved interaction

The whole application state is **(level, selection)**: four discrete levels,
one selected element, and the invariant that the selection is always a member
of the current level's peer set. There is no continuous zoom, no free pan,
and no mouse — the keyboard's discrete traversal is the interface.

- **Arrows** move the selection spatially, world-first: the nearest
  same-level peer in the pressed direction wins, including peers inside
  sibling boundaries. When no same-level peer lies that way but an element of
  an outer level does (a rail person, an external, a sibling of an ancestor —
  never an ancestor itself), the selection escapes the boundary to it and the
  app ascends to that element's level: leaving a boundary is zooming out.
  Arrows never descend.
- **Enter descends** one level, framed on the selection, handing selection to
  its first child in stable-id order. At the bottom of the ladder Enter
  expands instead: a component opens its detail pane — name, kind, unclamped
  description, relationships, code items when the model has them; any key
  closes it without acting.
- **Backspace and Esc ascend**, and ascending always selects the parent.
- **`1..4`** jump straight to a level: shallower jumps select the ancestor,
  deeper jumps descend the first-child chain, so jumps and single steps
  compose deterministically. Code stays honestly disabled while the model
  carries no code scan results.
- Level changes animate with a 750 ms ease-in-out-cubic camera tween in
  log-scale space; the camera only ever rests at a level. The camera is fully
  derived state — the current level's scale, positioned by a minimal-reveal
  policy around the selection. Nothing else can move it.
- A breadcrumb of the selection path (`groma › viewer › canvas`) answers
  "where am I"; `r` reloads the model from disk preserving level and
  selection; `?` shows help; `q` quits with the terminal restored.

## Presentation

- **Theme-native, brand-light.** No hardcoded colors anywhere: default
  terminal background and foreground, semantic ANSI palette colors (the
  theme's green for selection, planned additions, and the wordmark's `.md`
  suffix; yellow for planned modifications; red for planned removals), and
  emphasis as attribute tiers — bold, normal, dim, hidden — derived from the
  shared `emphasisAt` weights. Motion is continuous; emphasis is discrete.
- **The representation ladder.** Each element renders at the rung its cell
  budget affords — glyph, block, titled box, full card — and an element whose
  own C4 level is the current level never renders below the titled box: it is
  what the level is about, so persons and externals appear as bordered boxes
  with name and kind at Context.
- **No ASCII art.** The focal system's identity at Context is its emphasized
  folio header — bold name, dim description — because the system name comes
  from the model and must stay dignified for any project name at any length.
- Relationship lines route orthogonally with box-drawing characters and
  carry their grouped label as an erased chip at the route midpoint while
  their level is primary. Label placement must avoid occluding card text,
  boundary sub-labels, and other chips — the spike recorded this collision
  avoidance as required production work it deliberately did not do.

## Shared world model

The terminal viewer is a second renderer of the same world: it consumes
`loadRevision` → `buildArchitectureModel` → `projectArchitectureMap` and the
`emphasisAt` / `levelAt` / `hasCodeLevel` contract unmodified. Landmark
scales are derived for the terminal viewport with the production rules
(fit-derived Context and Containers, absolute Components and Code, minimum
adjacent-ratio spacing), with the cell grid's ~1:2 aspect corrected in the
projection. Whatever the production projection keeps private that the terminal
viewer needs — the zoom-derivation constants, code items on component nodes —
is exposed, not duplicated.

## Deliberately absent

- Continuous zoom, free pan, and mouse interaction
- Watcher-driven live reload in the terminal (manual `r` instead)
- Editing, saved cameras, minimap
- Truecolor brand painting or any hardcoded color, including 16-color
  degradation work — the theme owns color by construction
- A hand-built terminal renderer — OpenTUI is used directly
- Performance work beyond what the real model needs
