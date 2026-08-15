---
id: mvp
---

# MVP

## Outcome

When a human architect opens a viewer, this repository's architecture is
one fixed C4 world. Observed boxes are solid. This plan's new parts are
ghosts. `groma scan` refreshes source references without overwriting
curated Markdown. `groma accept <id>` applies a ghost only after a scan has
matched it. `groma view` starts the TUI plugin.

## Complete loop

1. `groma scan` sends candidates to core and prints `ok`. The plugin result
   has Code references and no architecture IDs.
2. Core attaches those results to the current world: refresh `code` on a
   known observed ID, or create a new observed element. Core does not accept
   a ghost.
3. A person or coding agent changes the architecture through Groma. New
   parts and required changes become plan ghosts. Explanations stay on
   observed documents.
4. This plan adds IDs that do not yet exist. Parents resolve against
   observed architecture.
5. `groma accept <id>` applies that document only when a scan has matched
   the ID. No match: accept fails. The ID does not change.
6. Core merges observed architecture and every plan into one world and
   returns that world to a viewer plugin.

## One world

- System Context, Containers, and Components are three levels over one
  geometry.
- There is one box per architecture ID. Planned items are ghosts.
- Layout runs when the architecture changes. Level, selection, details, and
  window size never move architecture elements.
- An unchanged model produces the same geometry. A changed model may
  produce a new deterministic best fit.
- Nobody places boxes. The selected system or container defines what
  zooming inward reveals.

TUI keys and chrome live in the [TUI viewer](../../../docs/viewers/tui/index.md).

## Deliberately absent

- A separate Code architecture element or fourth zoom level
- Scanner-owned Markdown writes
- Architecture IDs in application source
- Free placement of boxes
- Hand-editing files under `groma/`
- A command that prints the architecture (`groma get` or similar)
- A second identity that must be mapped back to a ghost
- Generic source-code understanding
- Compatibility with previous Groma prototypes
