# CLI

The CLI is a bounded adapter over shared application operations. It parses commands, reads explicit
JSON input, and renders human or JSON envelopes. It never reads canonical files, project sources, or
transaction state directly.

The implemented surface includes initialization, project registration, one bounded `scan`,
canonical component operations, bounded blueprint export/search/traversal, and a deterministic
self-contained local HTML blueprint opened by bare interactive `groma`. Noninteractive bare output
remains side-effect free.

`component get` returns canonical component detail and outgoing relationships alongside a separate
bounded evidence list, so plain and JSON consumers can inspect what a scan observed without
mistaking it for curated intent.

Binding-aware curation reuses existing commands: inspect the observed component and its revision,
merge it into the intended curated component with `component merge`, then scan again. The scan
follows the canonical alias, preserves curated intent, and keeps supporting evidence separate; no
second binding command or direct canonical-file edit is required.

Local package-management and schema-migration commands are deliberately absent. Adding them back
requires a concrete product need, not adapter completeness.
