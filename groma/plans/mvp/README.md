# MVP

## Outcome

When a human architect runs `groma view`, scanners provide a recognizable first architecture, Groma core reconciles it
into curatable Markdown, and the terminal viewer presents observed, missing, and every planned architecture as
one fixed, nested C4 world. Later scans refresh source references without overwriting curated Markdown.

## Complete loop

1. A scanner recognizes supported components and relationships in a source project and returns them to Groma core.
2. Core creates the first recognizable architecture or reconciles the results with stable existing components.
3. A person or coding agent improves names, responsibilities, relationships, and other Markdown prose.
4. Later scan results may refresh only component `code` frontmatter. Core preserves the Markdown body.
5. Core reads observed, missing, and every plan, adds runtime annotations from architecture location, calculates the fixed
   world with ELK, and returns the complete model and ELK layout objects to the viewer.
6. The architect reviews that model in the terminal viewer; the viewer never reads Markdown directly.

## Fixed-world viewer

- System Context, Containers, and Components are three semantic zoom levels over one geometry. The compact zoom control
  labels the first level `context`.
- Layout begins with every component and its relationships. Containers enclose their components, systems enclose their
  containers, and people and external systems sit around the internal systems.
- Layout runs when the architecture changes. Level changes, selection, details, and terminal resizing change only the
  camera or emphasis and never move architecture elements.
- An unchanged model produces the same geometry. A changed model may produce a new deterministic best fit.
- Relationships are displayed as directed arrows. Their useful emphasis at each level is tuned against the MVP during
  implementation rather than fixed before the result can be inspected.
- The selected system or container defines what zooming inward reveals.
- `+` enters the selected system or container without opening details, and `-` returns to its parent. Enter performs the
  same inward transition as `+` and opens details. The side panel overlays the world, and the camera fits as many direct
  children as possible into the remaining visible area without showing children of sibling containers. Full-screen
  details hide the world. Esc closes details, then exits Groma when no detail panel remains.
- Arrow keys select the nearest element in the pressed direction at the current level, even when it belongs to another
  parent. When none exists, selection moves to the nearest element in that direction at a higher level and zooms out.
  Ancestors are not directional targets, and arrows never descend.
- The footer shows `- context | containers | components +`; `z` moves focus to it and back to the previous architecture
  item.
- Core supplies `observed`, `planned`, and `missing` annotations. The viewer presents them as compact chips;
  planned and missing items use distinct theme colors and dotted borders.

## Deliberately absent

- Web viewer
- A separate Code architecture element or fourth zoom level
- Scanner-owned Markdown writes
- Continuous free zoom, free pan, or mouse input
- Animated camera transitions
- Watcher-driven reloads
- Visual editing
- Generic source-code understanding
- Compatibility with previous Groma prototypes
