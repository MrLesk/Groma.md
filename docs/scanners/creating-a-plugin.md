# Creating a scanner

A scanner is an ECMAScript module that implements `ScannerPlugin` from
`@groma/scanner`. It translates one source ecosystem into a complete
`ScanObservation`. It does not read architecture Markdown, write files, assign
architecture IDs, or combine source files into components.

```ts
import type { ScannerPlugin } from '@groma/scanner'

const scanner = {
  id: 'python',
  matchesFile: file => file.endsWith('.py'),
  async scan(repositoryRoot) {
    // Return one complete ScanObservation, or undefined when unsupported.
  },
} satisfies ScannerPlugin

export default scanner
```

`id` identifies the scanner inside Groma. `matchesFile` receives a
repository-relative path and lets the shared watch lifecycle decide whether to
rescan. `scan` receives the repository root and returns one complete
observation.

One successful call returns exactly one complete observation:

- `scanner`: language and engine identity;
- `root`: the solution, project, or package being scanned;
- `scopes`: project or import-based placement anchors;
- `files`: one entry per source file, with declarations from that file only;
- `placements`: inferred file-to-scope evidence;
- `relationships`: source-level imports or project references;
- `diagnostics`: deterministic scanner messages.

All paths are repository-relative. Scope and relationship endpoints must exist in the same observation. Duplicate primary keys and incomplete JSON are rejected before core reconciliation.

Language-specific project rules stay inside the scanner. The scanner registry
loads every registered module through the same contract, and core applies the rules
in the [scanner overview](index.md). A scanner must include a fixture proving
deterministic output, atomic files, placement, relationships, and failure
without partial output.
