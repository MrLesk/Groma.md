# Creating a scanner

Start with the [runnable authoring example](../../examples/scanner/README.md). Copy it
outside this repository to try local installation, scanning, and implementation changes.

A scanner is an ECMAScript module that implements `ScannerPlugin` from
`@groma/scanner`. It translates one source ecosystem into a complete
`ScanObservation`. It does not read architecture Markdown, write files, assign
architecture IDs, or combine source files into components.

This page describes the executable plugin contract. The
[evidence semantics](evidence.md) define operations, canonical targets,
concrete callback bindings, and unresolved alternatives. Architecture interpretation
belongs to [core's shared policy](../relationship-inference.md), not to each
language plugin. Plugins that do not extract operations omit both optional
operation fields; they still supply source inventory and root membership.

```ts
import type { ScannerPlugin } from '@groma/scanner'
import { scanPython } from './scan.ts'

const scanner = {
  id: 'python',
  watch: { include: ['**/*.py', 'pyproject.toml'], exclude: ['**/.venv/**'] },
  scan: scanPython,
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
depend on installation scripts. Bundle executable package imports into the entry
before distribution, as the authoring example does. Groma loads the bundled
entry and packaged assets; consumers do not build the plugin.

`id` identifies the scanner inside Groma. `watch.include` and `watch.exclude`
are required arrays of repository-relative patterns. They subscribe this
scanner to relevant source and configuration changes, including new files.
Patterns are anchored at the repository root and use `/` separators, `*`, `**`,
`?`, and character classes such as `[cC]`. Matching is case-sensitive; exclusions
override includes, and an empty include array never triggers a scan. For example,
`*.py` selects root files, while `**/*.py` also selects files in subdirectories.

The shared source runtime compiles these patterns once, applies shared project
exclusions, watches the filesystem, and schedules matching scanners. Plugins
supply subscription data and do not create watchers or match changed paths.
Watch patterns select scan triggers; compiler project rules still determine
the files analyzed by `scan`. Each `scan` receives the repository root and its optional settings object and returns one
complete observation, replacing this scanner's previous observation in the
session. Unaffected scanners retain their evidence for core's combined view.

A plugin may also implement `async checkReadiness(repositoryRoot, settings): Promise<void>`.
Return when supported source inputs and the scanner's own tools are available.
The installed scanner must carry the parsers, compiler libraries, workers and
runtimes needed for its supported source scan. A fresh checkout must not need
project dependency installation, a project build, or a separately installed
language SDK. Scanning must not download tools, execute install scripts, or run
project build steps. Missing external symbols leave individual facts unresolved;
they do not prevent inventory and provable local facts. Invalid source syntax
or unsupported project configuration may fail with a concrete diagnostic.
Reuse input validation in `scan`; callers need not run readiness first.
Plugins without a hook remain scannable.

A scanner may supply `readCodeStructure(repositoryRoot, references, settings)`
for the source outline in the viewers and static export. Each reference contains
`file` and the `symbols` named by the component's Code links. Return `CodeFile[]`
from the shared contract: functions and classes with source lines, visibility,
and entry markers. The TypeScript scanner supplies this existing outline.
The viewer uses only configured providers; a plugin without the hook contributes
no outline. These results are read-only source details, not architecture records.

## Discovery metadata

Optional `groma.scanner.discovery` describes when a project may benefit from
this scanner, without loading its code. Official scanners include it; third-party
scanners can use the same format. `ScannerDiscoveryMetadata` is exported by
`@groma/scanner`. Keep the package name, version, and description in the standard
`package.json` fields.

For a framework detected through a dependency:

```json
{
  "name": "@example/groma-scanner-ui",
  "version": "1.0.0",
  "description": "Architecture evidence for Example UI",
  "type": "module",
  "groma": {
    "scanner": {
      "id": "example-ui",
      "entry": "./dist/index.js",
      "discovery": {
        "technologies": ["example-ui"],
        "rules": [{
          "type": "dependency",
          "files": ["**/package.json"],
          "technology": "example-ui",
          "kind": "framework",
          "package": "@example/ui"
        }],
        "compatibility": {
          "groma": "^0.2.0"
        }
      }
    }
  }
}
```

`technologies` names the evidence the scanner actually supports. Each rule
reports a `technology` and a `kind` (`language` or `framework`) for matching
repository-relative `files`. File patterns use the same syntax as watch patterns,
but discovery rules and watch subscriptions have separate purposes. A rule may
report an additional technology outside `technologies` to expose a coverage gap.

| Rule type | Fields and behavior |
| --- | --- |
| `dependency` | `package`: dependency name in JSON dependency sections. Reads the declared version and resolves the installed version beside that project declaration. |
| `file` | `declaration`: explanation of the file-presence clue; version remains unresolved. |
| `xml` | `versionTags`: literal tags containing versions; semicolon lists are split. Optional `when: {tag, equals}` requires an exact tag value. `declaration` explains the clue when no version exists. |
| `toml` | `tables`: at least one named top-level table must exist. `versionPath`: keys leading to the version string. `declaration` explains the clue. |
| `text` | `versionPattern`: regular expression evaluated with the multiline flag; the first capture is the version. `declaration` explains the clue. |

Declare the supported Groma API range in `compatibility.groma`. Groma uses
that requirement and standard npm `os`/`cpu` fields to choose a published release
when the user installs a package by name. Language versions are discovery evidence,
not installation restrictions. Validate supported source configuration and
scanner-owned tools inside `scan`, with concrete instructions when something is
missing or unsupported. A tested example version is not a supported-version range.

The official catalog imports selected plugin manifests and is embedded by
`bun run build`. Updating metadata for an existing selected plugin needs no
technology-specific Groma code change. A new form of detection outside these
rule types requires a change to the shared reader. Unlisted third-party packages
remain installable by name, but Groma has no third-party discovery index.

## Scanner settings

All Groma scanner settings belong in the single `scanners.json` inside the
selected `groma/` or `.groma/` directory. Put optional `settings` on the
existing scanner entry beside `id` and `source`:

```json
{
  "scanners": [
    {
      "id": "csharp",
      "source": "./tools/csharp-scanner-package",
      "settings": { "input": "src/Library/Library.csproj" }
    }
  ]
}
```

Groma validates that `settings` is an object, preserves it during scanner
management, and passes only that entry's settings as the second argument to
both `checkReadiness` and `scan`. Omitted settings arrive as `undefined`.
Use a default parameter when the scanner has defaults:

```ts
import type { ScannerSettings } from '@groma/scanner'

async function scan(repositoryRoot: string, settings: ScannerSettings = {}) {
  const config = parseSettings(settings)
  return analyze(repositoryRoot, config)
}
```

The plugin owns setting names, value validation and defaults. Reuse the same
validation for readiness and analysis. Document supported keys and defaults,
and make errors identify the scanner and setting to correct. Resolve project
selection paths relative to the supplied repository root.

Scanners must not read `scanners.json` themselves or introduce separate
Groma configuration files. Keep native compiler settings in native project
files such as `tsconfig.json`, `Cargo.toml` and `.csproj`. Pass parsed
settings to a native worker through its existing invocation interface.

Settings load when Groma creates the scanner session. After editing them, run
a new scan or restart the active viewer or watch session. Plugin watch patterns
cover native source and project files; they do not reload Groma settings.

These settings are Groma runtime configuration, not OKF knowledge records or
C4 elements. The scanner module loader owns their delivery; the plugin owns
their meaning. Architecture Markdown stays readable without interpreting them.

## Observation contract

Return an observation when the declared analysis succeeds. Throw when it fails;
return `undefined` when the scanner does not support the selected project.
There is no `complete` flag. Success does not claim knowledge of every runtime
behavior. Build results with `createScanObservation`; native workers emit the
same JSON, which their module reads with `parseScanObservation`.

- `schemaVersion`: `1`, identifying the shared JSON contract.
- `scanner`: stable `id`, analyzed `technology`, `engine`, and `engineVersion`.
  The ID matches the plugin ID, such as `react`. Technology describes the
  ecosystem, such as `typescript/react`, `typescript/vue`, or `c#/.NET`.
  Engine names the actual analysis tool, such as `typescript-sdk`,
  `@angular/compiler-cli`, or `roslyn`. Its version is the tool's version.
- `roots`: source analysis units, such as solutions, projects, packages, modules,
  or inferred source groups. Each has an observation-local `id`, `kind`, and
  `name`. Optional `file` identifies its defining repository file; optional
  `parent` links to another root in the same observation.
- `files`: one entry per physical source path, with nonempty `roots` membership
  and declarations in `symbols`. A file may belong to more than one root.
- `operations` and `invocations`: optional executable work and call evidence.
  Operations may include source ranges and binding-normalized body tokens.
- `diagnostics`: messages with `severity`, `code`, and `message`; optional `file`
  and positive, one-based `line` locate the issue without embedding its location
  in the message. A project-level message can omit both.

Only the stable scanner ID enters architecture Code references. Technology and
engine details describe how the scan evidence was produced; core does not store
them in architecture Markdown.

### Source hierarchy

A solution remains visible above its projects. Independent projects or packages
can also appear as separate top-level roots. There is no mandatory repository
root and no fixed number of hierarchy levels:

```json
{
  "schemaVersion": 1,
  "scanner": {
    "id": "csharp",
    "technology": "c#/.NET",
    "engine": "roslyn",
    "engineVersion": "5.9.0.0"
  },
  "roots": [
    { "id": "solution", "kind": "solution", "name": "Shop", "file": "Shop.sln" },
    { "id": "api", "kind": "project", "name": "API", "file": "Api/Api.csproj", "parent": "solution" },
    { "id": "worker", "kind": "project", "name": "Worker", "file": "Worker/Worker.csproj", "parent": "solution" }
  ],
  "files": [
    {
      "file": "Api/Orders.cs",
      "roots": ["api"],
      "symbols": [{ "id": "global::Orders", "name": "Orders", "kind": "class" }]
    },
    { "file": "Worker/Program.cs", "roots": ["worker"], "symbols": [] }
  ],
  "diagnostics": []
}
```

Root kinds describe source structure, not C4 roles. A solution can be a useful
clue to a system boundary and a project to a container boundary, but neither
proves that boundary. Core owns the interpretation. For initial placement it
uses each top-level root as a system clue and roots with file membership, or
leaf roots, as container clues. Intermediate groups add no extra C4 level.
Existing curated file ownership takes precedence.

For a shared source, one file record can list `roots: ["api", "worker"]`.
This records membership, not several architecture owners. A scanner must not
merge different compilation contexts into a contradictory certain call target.
The C# scanner currently rejects files shared by multiple loaded compilation
contexts; the shared contract does not extend that scanner's supported analysis.

Roots remain temporary evidence, not stored OKF concepts or new C4 boxes.
An ordinary Markdown or OKF reader sees the existing architecture records,
Code links, and relationship statements. Groma core owns source placement and
identity under its existing architecture profile. This distinction applies to
solutions, monorepos, and source groupings in other languages as well.

### Symbols, operations, and invocations

A symbol describes a declaration in a file. Its `id` is chosen by the scanner
and is local to its observation; it is not a Groma architecture ID. `name` is
the readable declaration name and `kind` its source category. Core uses symbols
for named Code references. A class, interface, type alias, or constant can be a
symbol without being executable work.

An operation describes executable work: a function, implemented method, or
supported initializer. A method may appear as both a symbol and an operation,
because named Code references and call analysis use different information.
An invocation reports a call from one operation to its possible target operations.

Imports, type uses, constants, and base classes do not necessarily invoke an
operation. Imports may also execute module initialization. Keep dependency graphs
inside the scanner when analysis needs them; the shared observation has no
source `relationships` field. These facts do not become architecture
relationships merely because they exist. Core selects supported interactions
from operation and invocation evidence.

An operation has an opaque observation-local `id`, exact `file`, and `name`.
For cross-scanner comparison it also supplies `position`, the zero-based
UTF-16 offset of its declaration start, excluding leading trivia. Invocations
use the same `position` convention for the call expression. These positions
refer to the shared source text, not compiler node or symbol IDs.
It may also supply `startLine`, `endLine`, and `tokens`: a binding-normalized
sequence of the operation body. Local names become slots; operators, literals,
property names, and unresolved identifiers stay visible. Core compares those
tokens to report architecture findings; the scanner does not decide that
duplication is a problem. Plugins that do not tokenize omit these fields.
An invocation has its caller operation `source`, canonical operation `targets`,
one-based call `line`, and an explicit `unresolved` boolean. A named member call
also supplies `member`. When a concrete argument supplies the invoked value,
`binding: { file, line, position }` identifies that call site. A named Angular
output-to-handler binding uses the template event attribute's start position.
Keep separate bindings
separate; alternatives within one binding share one target set. Empty targets
must be unresolved. `unresolved: false` is scoped to the supported extraction,
not a promise that the whole language or runtime is modeled.

Positions are optional for scanners that do not participate in overlapping
operation analysis. Cross-scanner comparison requires positions for the
caller, invocation, binding if present, and every target declaration. Core
compares certain provider sets only within that exact source and binding
context; differing certain sets are conflicts, while unresolved observations
do not veto a supported claim. See [overlapping observations](evidence.md#overlapping-observations).
The TypeScript scanner and Angular scanner identify their respective
Code contributions as `typescript` and `angular`, even when they inspect the
same file. Core keeps one owner for that source path.

All paths are repository-relative. Root parents and file memberships must resolve
inside the observation, and the root hierarchy must have no cycles. Invocation
endpoints must identify declared operations. Duplicate primary keys and malformed
JSON are rejected before core reconciliation. Diagnostic locations are preserved
when ordering and removing duplicate messages.

Language-specific project rules stay inside the scanner. The scanner registry
loads every enabled module through the same contract, and core applies the rules
in the [scanner overview](index.md). A scanner must include a fixture proving
deterministic output, atomic files, root membership, supported operation
evidence, and failure without partial output.

## Add a scanner

Use an exact npm version, a Git tag or full commit, or a project-relative local package:

```sh
groma scanner add @example/groma-scanner-python@1.0.0
groma scanner add ./plugins/scanners/python
groma scanner add git+https://github.com/example/python-scanner.git#v1.0.0
```

`add` validates the installed package before writing `scanners.json` in the
selected `groma/` or `.groma/` directory.
Npm and Git packages live in Groma's shared `~/.groma/cache/scanners` cache. Local
packages run directly from the configured path.

```sh
groma scanner list
groma scanner install
groma scanner remove python
```

`install` restores configured npm and Git packages. `remove` disables a scanner without
deleting shared cache data.

For a runnable example, use the [inventory teaching scanner](https://github.com/MrLesk/groma-scanner-example/tree/v0.1.0)
with its supplied project fixture and Groma 0.3.0 or later:

```sh
groma scanner add 'git+https://github.com/MrLesk/groma-scanner-example.git#v0.1.0'
```

A Git source must use public HTTPS and contain one runnable scanner package at
its repository root. Include bundled entry code and required worker assets in
the selected tag or commit. Groma installs declared dependencies with installation
scripts disabled; it does not compile the scanner. Git must be available locally.
Groma resolves a tag to its full commit and records that commit in `scanners.json`.
Commit this project configuration so teammates restore the same scanner even
when a tag moves. Local paths stay local; package downloads are shared, but each
project chooses its own scanners and settings. Scan and watch never install packages, search global
packages, or load an unconfigured module.

## Update a scanner

For an npm scanner, omit the source or use its package name to install the newest
compatible stable release. You can also choose an exact version of the same npm
package, or a tag or commit in the same Git repository:

```sh
groma scanner update python
groma scanner update python @example/groma-scanner-python
groma scanner update python @example/groma-scanner-python@1.1.0
groma scanner update python git+https://github.com/example/python-scanner.git#v1.1.0
```

Groma installs and validates the replacement before recording its exact source.
The scanner ID must remain the same. A failed or rejected replacement leaves
project configuration unchanged. Scanner settings, project exclusions and
other scanner selections are preserved. Other projects keep their own versions.
Use `groma scanner list` and `groma scanner check` to inspect the result;
`groma scanner install` restores the recorded version or commit.

Updates are explicit. Scanning, starting a viewer or upgrading Groma does not
select a newer scanner. Local plugins continue to run from their configured
folder; rebuild their entry and restart Groma after changing their code.
