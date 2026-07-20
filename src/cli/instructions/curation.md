# Curation

Curation is how people and agents give parts of the system their meaning: what each
component is for, what lives inside what, and how parts relate.

## Creating and changing components

Component create and update take one bounded JSON envelope via `--input <file|->` or
`--stdin`; see `groma component create --help` for the exact fields. A component
needs only a name to be useful — intent, inputs, outputs, actions, and recognition
metadata (a short label, a one-sentence summary, an `iconDomain` hint) can grow over
time. Nobody should have to complete a questionnaire before a part exists.

- `groma component update` requires the component's exact current revision; read it
  first with `groma component get <id> --relationships-limit 1`. A stale revision is
  rejected instead of overwriting someone else's change.
- `groma component reparent <id> --revision <rev> (--parent <id> | --root)` moves a
  part inside a different parent or makes it a top-level part. Containment can never
  form a cycle.
- `groma component remove <id> --revision <rev>` takes a part off the map.

## Merging duplicates

`groma component merge <obsolete-id> --into <survivor-id> --revision <rev>` squishes
two copies of the same part into one. Merge is the only operation that creates an
alias: old references keep resolving to the survivor. Nothing else renames or
rebinds identity.

## Rules

- Stable IDs are identity; names and paths are labels. Renames never change identity.
- Relationships carry meaning between parts; use short type words such as `requires`
  or `informs`, with an optional description.
- When Groma cannot tell whether two things are the same component, it stops and
  reports instead of guessing. Resolve ambiguity explicitly with update or merge.
- Never edit the files under `groma/` directly; the CLI keeps metadata, ordering,
  and history consistent.
