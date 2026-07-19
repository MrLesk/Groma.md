# CLI

The CLI is a bounded adapter over shared application operations. It parses commands, reads explicit
JSON input, and renders human or JSON envelopes. It never reads canonical files, project sources, or
transaction state directly.

The implemented surface includes initialization, project registration, one bounded `scan`,
canonical component operations, and bounded blueprint export/search/traversal. The visual
experience is not implemented yet; bare overview must remain honest about that.

Local package-management and schema-migration commands are deliberately absent. Adding them back
requires a concrete product need, not adapter completeness.
