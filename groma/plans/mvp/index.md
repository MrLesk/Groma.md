# MVP

## Outcome

When a human architect opens a viewer, this repository's architecture is
one fixed C4 world. Observed boxes are solid. This plan's new parts are
ghosts. `groma scan` refreshes source references without overwriting
curated Markdown. `groma accept <id>` applies a ghost only after a scan has
matched it.

## Complete loop

1. `groma scan` sends candidates to core and prints `ok`.
2. Core attaches those results to the current world: refresh `code` on a
   known observed ID, or create a new observed element. Core does not accept
   a ghost.
3. An actor changes the architecture through Groma. New
   parts and required changes become plan ghosts. Explanations stay on
   observed documents.
4. This plan adds IDs that do not yet exist. Parents resolve against
   observed architecture.
5. `groma accept <id>` applies that document only when a scan has matched
   the ID.
6. Core merges observed architecture and every plan into one world and
   returns that world to a viewer plugin.

This plan is complete. Its index remains as the record.
