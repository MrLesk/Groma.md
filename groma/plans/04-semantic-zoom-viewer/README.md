# Revision 04 — Semantic zoom viewer

## Outcome

When a human architect opens the local viewer and zooms or pans the map, Groma
shows the whole architecture in one coordinate space. Context, containers, and
components become the primary detail at named zoom levels without moving or
resizing their world geometry at the boundary between levels.

The viewer is rebuilt on an open-source graph visualization library that already
provides the camera, interaction, nesting, and rendering foundations. Groma only
adds the C4 meaning and presentation needed by this revision.

## Approved interaction

- Context, containers, components, and code occupy fixed, nested positions on
  one map.
- Continuous zoom changes camera magnification.
- Crossing a named level — Context, Containers, Components, or Code — changes
  visibility and visual emphasis globally as a crossfade, not a discrete
  switch.
- A level change never relays out the map or replaces it with a separate
  diagram.
- Panning at any zoom reaches another part of the same architecture at the same
  level of detail.
- A visible control provides plus, minus, named level landmarks, and a
  continuous slider carrying the four fixed level breakpoints.
- Cards, code items, and relationship lines are crisp and readable when their
  level is primary.

The interaction was confirmed by the human architect on 2026-08-01 against a
live single-file reference example built without any candidate library.

## Rendering foundation selection

**React Flow (`@xyflow/react` 12.11.2) is the rendering foundation.** It
reproduced the approved four-level interaction without accommodation, remained
readable at 1,000 components, sustained the continuous crossfade, and is
already the viewer's renderer. Retaining it is therefore the smallest supported
implementation.

The candidate inventory, alternative implementations, benchmarks, and
withdrawn decisions remain in the
[historical semantic-zoom investigation](../../../docs/historical-investigations.md#semantic-zoom-renderer-selection)
on branch `spike/semantic-zoom-renderer-selection` at commit `54d8fd0`. That
branch is evidence only and must never be merged.

## Final design — Field Notes, one world

The production viewer keeps its Architecture Field Notes visual language
unchanged and replaces only its paged decomposition with the confirmed
fixed-world semantic zoom. Agreed 2026-08-01 with the human architect: the
current viewer "looks more Groma" — the fold changes the camera model, never
the aesthetic.

- **Brand skin from the official Groma brand** (`../groma/brand`, canonical
  README + STYLE): the Field Notes concept stays, but the palette becomes the
  brand's — subtly warm-white paper, near-black graphite and cool neutral
  gray structure, and the single Groma green accent `#1D9E75` reserved for
  lines, marks, underlines, and states (never small text, per the brand's
  contrast rule; small-caps annotations stay ink/gray). Planned-addition
  adopts the brand green, planned-modification the brand-sanctioned
  restrained amber, planned-removal stays muted red; all non-color cues
  (hatching, badges, dashes) remain. The header uses the byte-exact
  `mark-frontal.svg` glyph and the lowercase `groma` wordmark with the green
  `.md` suffix — never title-case. The decorative rust/navy/cream and the
  "G" square of the previous iteration are retired.

- **One fixed nested world** on the existing paper + graph-grid canvas: the
  focal system as the inked `C4 / SYSTEM` boundary folio, container
  boundaries nested inside it, component cards nested inside containers,
  persons in a left rail and external systems in a right rail. Layout derives
  deterministically from the complete model with stable-id ordering. Reloading
  an unchanged model reproduces the same geometry; when components or
  relationships change, the viewer may recompute a deterministic best fit.
- **Four landmarks** — Context, Containers, Components, Code. Context and
  Containers are fit-derived from the world size; Components and Code are
  absolute because card size is constant. Level boundaries sit at geometric
  means of adjacent landmarks; emphasis crossfades over derived bands exactly
  as in the approved reference (the `emphasisAt` channel contract carries
  over verbatim).
- **Cards and boundaries keep today's anatomy**: kicker glyph + small-caps
  kind, serif names, clamped descriptions, 6px spines, hard offset print
  shadows, and every planned-addition/modification/removal variant including
  hatching and badges. At Context the focal boundary carries a large serif
  identity title that crossfades away as the camera descends, handing off to
  the existing boundary header.
- **Relationships** draw once, at the level of their deepest endpoint, as
  border-anchored bowed quadratics with the viewer's grouped mono label boxes
  at the curve midpoint and rust arrowheads; each level's edges crossfade
  with its landmark.
- **Chrome mapping**: the top-center breadcrumbs become the four landmark
  buttons in the same mono-uppercase, rust-underline idiom; the legend panel
  becomes zoom-aware (`C4 / 01 System context` … `C4 / 04 Code`) while
  keeping the planned-change legend; the bottom-right cluster gains a
  continuous log-scale slider carrying the four fixed breakpoints as ticks,
  plus the existing plus/minus and a mono zoom readout; the footer keeps
  element/relationship counts and interaction hints.
- **Interaction** is the proven React Flow implementation: one persistent
  canvas, center-anchored `zoomTo`, native wheel/pinch/drag, 750 ms
  ease-in-out-cubic landmark animation interpolated in log space, and the
  CSS-custom-property emphasis mechanism that crossfades with zero React
  re-renders (~80 fps at 1,000 components in the selection evidence).
- **Code level reads component frontmatter**: each code chip shows the scanner,
  exact repository-relative file, and optional symbol from a component's
  `code` list. The current model carries no entries yet, so until a scanner
  provides them the Code level states plainly that no code-level scan results
  exist. No placeholder data is fabricated.
- **Everything behavioral is preserved**: the `/api/model` and `/api/events`
  contracts, watcher scope, plan-vs-observed comparison rendering, and live
  reloads as data refreshes that keep the camera where the architect left it.

## Replacement boundary

This revision replaces the viewer's paged decomposition with the fixed-world
map on the existing React Flow foundation. It keeps Markdown as the
architecture authority and the parsed architecture model as the viewer's
input. The new map replaces the current rendering path directly; there is no
compatibility adapter, dual renderer, or migration mode.

## Deliberately absent

- A hand-built SVG, Canvas, or WebGL rendering engine
- Editing the architecture on the canvas
- Saved camera positions
- Automatic layout for arbitrary repositories
- Performance hardening beyond behavior reproduced by the common 500- and
  1,000-component fixtures
- Fallback rendering
