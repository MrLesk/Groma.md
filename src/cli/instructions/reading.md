# Reading the Map

Every ordinary read returns exactly one bounded page. Limits are explicit, `hasMore`
says when there is more, and cursors are opaque tokens you pass back unchanged.
Nothing follows a cursor implicitly.

## The views

- **Tree** — bare `groma` in an interactive terminal opens the visual blueprint;
  `groma --format json` returns the same bounded hierarchy as data.
- **Web** — `groma web` serves the interactive blueprint on 127.0.0.1 only, with
  bounded reads behind it. Its technical-sheet canvas starts with one root page and
  descends by component scale only when you explicitly open a component or request
  the next bounded page. It is read-only and makes no other network requests.
- **List** — `groma component list|roots|children <parent-id> --limit <1-100>` pages
  through components.
- **Detail** — `groma component get <id> --relationships-limit <1-100>` returns one
  component with its intent, recognition metadata, a bounded relationships page, and
  the scan evidence bound to it.
- **Search** — `groma blueprint search <text> --limit <1-100>` finds components by
  their words.
- **Export** — `groma blueprint export --limit <1-100>` pages the whole map as
  self-contained items (component plus outgoing relationships), all at one
  generation.
- **Traverse** — `groma blueprint traverse <id> --direction incoming|outgoing|both
--depth <1-16> --limit <1-100>` walks relationships deterministically.

## Reading discipline

- Prefer search and detail over exporting everything; the map is meant to be read a
  bounded page at a time.
- Every page reports its generation. If a long read spans a change, start again
  rather than mixing generations.
- If an export page exceeds local bounds, retry with a smaller `--limit`.
- Use `--format json` for structured output; plain output is for people.
