# Creating a scanner

A scanner is an ECMAScript module that implements `ScannerPlugin` from
`@groma/scanner`. It translates one source ecosystem into a complete
`ScanObservation`. It does not read architecture Markdown, write files, assign
architecture IDs, or combine source files into components.

This page describes the executable plugin contract. The
[evidence semantics](evidence.md) define operations, canonical targets,
concrete callback bindings, and unresolved alternatives. Architecture interpretation
belongs to [core's shared policy](../relationship-inference.md), not to each
language plugin. Plugins that do not extract operations omit both optional
operation fields; they still supply source inventory and placement.

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

Declare the module entry in the package manifest:

```json
{
  "name": "@example/groma-scanner-python",
  "version": "1.0.0",
  "type": "module",
  "groma": {
    "scanner": {
      "id": "python",
      "entry": "./src/index.ts"
    }
  }
}
```

The manifest ID must match the default export. The entry must be a file inside
the package. Scanner packages are TypeScript or JavaScript modules and must not
depend on installation scripts.

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
- `relationships`: temporary source-level imports or project references;
- `operations` and `invocations`: optional temporary operation and wiring evidence;
  operations may include source ranges and binding-normalized body tokens;
- `diagnostics`: deterministic scanner messages.

An operation has an opaque observation-local `id`, exact `file`, and `name`.
It may also supply `startLine`, `endLine`, and `tokens`: a binding-normalized
sequence of the operation body. Local names become slots; operators, literals,
property names, and unresolved identifiers stay visible. Core compares those
tokens to report architecture findings; the scanner does not decide that
duplication is a problem. Plugins that do not tokenize omit these fields.
An invocation has its caller operation `source`, canonical operation `targets`,
one-based call `line`, and an explicit `unresolved` boolean. A named member call
also supplies `member`. When a concrete argument supplies the invoked value,
`binding: { file, line }` identifies that call site. Keep separate bindings
separate; alternatives within one binding share one target set. Empty targets
must be unresolved. `unresolved: false` is scoped to the supported extraction,
not a promise that the whole language or runtime is modeled.

All paths are repository-relative. Scope, operation, and relationship endpoints must exist in the same observation. Duplicate primary keys and incomplete JSON are rejected before core reconciliation.

Language-specific project rules stay inside the scanner. The scanner registry
loads every enabled module through the same contract, and core applies the rules
in the [scanner overview](index.md). A scanner must include a fixture proving
deterministic output, atomic files, placement, relationships, and failure
without partial output.

## Add a scanner

Use an exact npm version or a project-relative local package:

```sh
groma scanner add @example/groma-scanner-python@1.0.0
groma scanner add ./plugins/scanners/python
```

`add` validates the installed package before writing `scanners.json` in the
selected `groma/` or `.groma/` directory.
Npm packages live in Groma's shared `~/.groma/cache/scanners` cache. Local
packages run directly from the configured path.

```sh
groma scanner list
groma scanner install
groma scanner remove python
```

`install` restores configured npm packages. `remove` disables a scanner without
deleting shared cache data. Scan and watch never install packages, search global
packages, or load an unconfigured module.
