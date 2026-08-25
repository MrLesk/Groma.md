# Creating a scanner

A scanner translates one source ecosystem into `ScanObservation` from `src/scanner/observation.ts`. It does not read architecture Markdown, write files, assign architecture IDs, or combine source files into components.

One successful call returns exactly one complete observation:

- `scanner`: language and engine identity;
- `root`: the solution, project, or package being scanned;
- `scopes`: project or import-based placement anchors;
- `files`: one entry per source file, with declarations from that file only;
- `placements`: inferred file-to-scope evidence;
- `relationships`: source-level imports or project references;
- `diagnostics`: deterministic scanner messages.

All paths are repository-relative. Scope and relationship endpoints must exist in the same observation. Duplicate primary keys and incomplete JSON are rejected before core reconciliation.

Language-specific project rules stay inside the scanner. Core receives the same contract from every language and applies the rules in the [scanner overview](index.md). A scanner must include a fixture proving deterministic output, atomic files, placement, relationships, and failure without partial output.

There is no plugin registry in this prototype. `scanRepository` calls the supported scanners directly and reconciles their completed observations as one batch.
