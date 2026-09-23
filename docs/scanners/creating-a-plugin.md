# Creating a scanner

Start with the [runnable authoring example](../../examples/scanner/README.md). Copy it
outside this repository to try local installation, scanning, and implementation changes.

A scanner is an ECMAScript module that implements `ScannerPlugin` from
`@groma/scanner`. It translates one source ecosystem into a complete
`ScanObservation`. It does not read architecture Markdown, write files, assign
architecture IDs, or combine source files into components.
It may report explicit source associations through `sourceUnits`; core decides
whether existing ownership permits one component for those files.

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
the files analyzed by `scan`. Each `scan` receives the repository root, its optional settings object,
and a shared exclusion predicate as the optional third argument. A scanner that
can filter its source inventory should apply the predicate before parsing;
Groma also filters returned evidence. The scan returns one complete observation, replacing this scanner's previous observation in the
session. Unaffected scanners retain their evidence for core's combined view.

## Explicit source units

`sourceUnits` is an optional array of `{ primary, files }`. Both fields use exact
repository-relative source paths; every member must be in `files` inventory,
and the primary must be a member. The primary identifies the source declaration
used for initial component naming and placement. For example, a framework can
associate a class with its explicitly declared template and styles. Do not use
filename similarity, ordinary imports, or folder proximity to propose a unit.

Overlapping declarations remain separate claims for core to review, never a
request for a transitive merge. Project relocation updates every member path.
Shared exclusions remove excluded members, and remove a whole unit when its
primary is excluded. Scanners must watch their companion file types as well as
the declaring source.

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

## Source outline

Every official scanner implements
`readCodeStructure(repositoryRoot, references, settings)`. It supplies the
declarations listed under a component's Code in the web and terminal maps and
the static export. The hook is optional for other plugins; a plugin without it
contributes no outline. So does a scanner that cannot load or outline on this
computer, such as one missing its native worker; the maps and the static export
keep every other scanner's outline. The outline is read-only source detail, never an
architecture record. Build it by parsing source only: no project dependencies,
builds, or project tools.

Each reference holds one owned `file` and the `symbols` its Code links name.
When a file has Code links from several configured scanners, the one with the
lowest id outlines it, with the symbols of all those links. The lowest id wins
among every configured scanner, so a file whose lowest one has no
`readCodeStructure` gets no outline. Return one `CodeFile`
(`{ file, declarations }`) per reference; omit files without declarations. Groma
orders the files by the component's Code. List `declarations` in source order.

Top-level means directly in the file or inside a namespace, package, or module
block, such as a C# `namespace`, a braced PHP namespace, a TypeScript
`namespace` or `module`, a Rust inline `mod`, or a Swift `extension` body. A
declaration inside another type or function is nested and is not listed. PHP
also counts a function declared directly inside `if (!function_exists('name'))`
as top-level when the guard names that function. C# top-level statements, with
the local functions and lambdas they declare, form the program's entry point
and are not listed.

- `kind: 'function'` is a top-level function, or a function literal (arrow
  function, function expression, or lambda) assigned directly to a top-level
  name. Wrapped values such as `memo(...)`, `forwardRef(...)`, or
  `partial(...)` are not listed.
- `kind: 'type'` is a top-level class, interface, struct, record, enum, trait,
  or protocol, or a Go defined type such as `type X struct{}` or `type X int`.
  A named type whose form is a function, such as a C# `delegate` or a Go
  `type X func(...)`, is a type with an empty `members` list. Type aliases are
  never listed: TypeScript `type X = ...`, Go `type X = Y`, and Rust
  `type X = ...`.
- A type's `members` are the functions declared in its body or in an `impl`
  block for it: static or instance, with or without a body, including
  interface method signatures, abstract methods, and constructors. Each
  declaration is listed separately, including overloads and TypeScript overload
  signatures. Constructors use their source name, such as `constructor`,
  `__init__`, `__construct`, or the type name.
- Fields, properties, property signatures (even with a function type),
  accessors, methods with a computed name such as `[key]()`, and nested types
  are not listed.
- Methods declared apart from their type, as Go receiver methods, Rust `impl`
  blocks and Swift extensions are, belong to one entry for that type per file.
  When the file declares the type, the entry is that declaration (in Swift, at
  the first of the declaration and its extensions) with the type's visibility.
  Otherwise the entry has the line of the file's first such method or block,
  and its visibility comes from the type name in Go, from the first
  extension's access in Swift (`internal` when it states none), and is
  `public` in every other language.

Every declaration and member has `name`, `line` (the 1-based line of the
name), `visibility`, and `entry`. `entry` is true when the reference's `symbols`
name the symbol in the spelling that scanner's Code links use: a member
qualified by its type, or its bare name. Members are `Type.member` in Java, C#,
and Python, and `Namespace\Type::method` in PHP, beside a top-level
`Namespace\name`; every other scanner matches bare names. A link naming a type
never marks its members.

`visibility` states who may use the name:

| Value | Who may use it |
| --- | --- |
| `public` | Any code that can depend on the declaring file, module, or package |
| `protected` | The declaring type and its subtypes |
| `internal` | Code in the same package, module, assembly, or crate |
| `private` | A member: the declaring type. A top-level declaration: the declaring file or module |

Apply the language's own rule, including its default when the source has no
modifier. A member keeps its own access; the enclosing type does not narrow
it. Any access that also admits subtypes is `protected`. Languages map as
follows; a dash means the language has no such case.

| Language | `public` | `protected` | `internal` | `private` |
| --- | --- | --- | --- | --- |
| TypeScript, Angular, React | Top-level `export`, or a name in the file's own `export { name }` list, `export default name`, or `export = name`; members without `private` or `protected` | `protected` | - | Other top-level declarations; `private` and `#name` members |
| JavaScript | Top-level `export`, a name in the file's own `export { name }` list or `export default name`, a name a CommonJS `module.exports` or `exports.name` assignment publishes, and every top-level declaration of a file that states no `import`, `export` or CommonJS export, because those names are globals; members without a `#` name | - | - | Other top-level declarations; `#name` members |
| Vue | As TypeScript in `<script>` | As TypeScript | - | As TypeScript; every `<script setup>` top-level declaration |
| Java | `public`; interface members without a modifier | `protected` | No modifier elsewhere (package access) | `private` |
| C# | `public`; interface members without a modifier | `protected`, `protected internal`, `private protected` | `internal`; top-level types without a modifier | `private`; other members without a modifier |
| Go | Names starting with an upper-case letter | - | Other names | - |
| Rust | `pub`. Methods in a trait definition take the trait's visibility, and methods in a trait `impl` are `public` | - | `pub(crate)`, `pub(super)`, `pub(in path)` | No `pub`, `pub(self)` |
| Python | Other names, including `__init__` and other `__dunder__` names | Members named `_name` | - | Members named `__name`; top-level names starting with `_` |
| PHP | `public`; members without a modifier; top-level functions and types | `protected` | - | `private` |
| Swift | `open`, `public` | - | `package`, `internal`; no modifier elsewhere | `fileprivate`, `private` |

TypeScript re-exports from other files (`export { name } from '...'`) do not
change any declaration's visibility. Python visibility comes from names alone;
`__all__` does not change it. A JavaScript `.mjs` or `.cjs` file is a module
whatever it contains. A Swift member of a protocol or an extension takes that
declaration's access when it states none of its own.

## Source file listing

Every official scanner implements
`listSourceFiles(repositoryRoot, settings)`. It returns the repository-relative
files this scanner would analyze for these settings, selected the way `scan`
selects them, without analyzing a file, starting a language server, or running a
project tool such as Maven, Gradle, `dotnet`, `go` or `cargo`. Watch patterns are
not that selection: they subscribe to changes, so they include configuration and
test sources a scan never reads.

Report the files whose analysis can give a component its Code, and leave out what
the scan ignores: test sources, generated output, vendored code and build
directories.

A listing may name a file the analysis then leaves out, because deciding that
would mean analyzing it or running a build. Each approximation an official
scanner makes:

| Scanner | Can also list |
| --- | --- |
| Rust | A `.rs` file under a target root module's directory that no crate root declares |
| Go | A file its build constraints exclude, such as `_windows.go` or a `//go:build` tag the scan does not select |
| C# | A file an MSBuild item glob excludes from the project |
| Angular, Vue | A template or stylesheet no component declares |
| React | Any source the TypeScript scanner reads, while the repository has a React project, including files no React package compiles |

A listing must never leave out a file the scan does read: that would report the
file as read by no enabled scanner.

Groma uses the listing to explain a file with no architecture owner. `groma view`
on such a file exits non-zero with one reason: it is not a repository file, a
named `scanners.json` pattern excludes it, no enabled scanner reads it, or it
waits for a scan by the scanners that read it, because it is new or was
detached. A listing that throws names its scanner with the error's first line,
beside the other scanners' answer. A plugin without the hook
contributes nothing to that answer, so a file only that plugin reads is reported
as read by no enabled scanner.

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
          "groma": ">=0.3.0"
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
| `file` | `declaration`: explanation of the file-presence clue; version remains unresolved. Patterns that are all extension globs report one summarized discovery line per technology, with the file count and the first path; any exact filename keeps one line per matching file. |
| `xml` | `versionTags`: literal tags containing versions; semicolon lists are split. Optional `when: {tag, equals}` requires an exact tag value. `declaration` explains the clue when no version exists. |
| `toml` | `tables`: at least one named top-level table must exist. `versionPath`: keys leading to the version string. `declaration` explains the clue. |
| `text` | `versionPattern`: regular expression evaluated with the multiline flag; the first capture is the version. `declaration` explains the clue. |

Declare the minimum Groma API version the scanner needs in `compatibility.groma`,
such as `>=0.3.0`. Later stable Groma versions remain eligible. Raise the minimum
only when the scanner uses an API introduced in a newer Groma version.
Groma uses that requirement and standard npm `os`/`cpu` fields to choose a published release
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
The optional third `scan` argument tests repository-relative paths against
Groma's shared exclusions. It is separate from scanner-owned settings.
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
- `entryPoints`: optional [execution-entry facts](evidence.md#execution-entries-and-container-placement):
  physical entry `file`, its source/configuration `declaration`, declared `name`,
  and analyzed `files` in that entry's own source unit. They carry no C4 decision.
- `operations` and `invocations`: optional executable work and call evidence.
  Operations may include source ranges and binding-normalized body tokens.
- `httpEndpoints` and `httpRequests`: optional HTTP facts linked to operations.
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

Root kinds describe source structure, not C4 roles. A solution, package or
project does not prove an application boundary. Core owns the interpretation
and preserves existing curated file ownership. A source group can help reuse
an established container, but it cannot create one. Source roots also cannot
create additional systems; the [initial system default](index.md) belongs to
core. Placement evidence must agree on a container or its common system across
all scanners. Components whose container
is unknown stay within their known system, shown in an **Unidentified container**
group. Empty source groups create no architecture. Intermediate source groups
add no C4 level.

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
duplication is a problem. The
[compared operations rule](../architecture-findings.md#compared-operations)
states which operations carry tokens, so a scanner tokenizes no anonymous
callback and filters no body by size. Plugins that do not tokenize omit these
fields. The map shows an operation's copies under its outline row only when the
operation's range holds the row's line and its `name` ends in the row's name,
as `Shop\OrderService::store` ends in `store`.
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
endpoints and HTTP facts must identify declared operations. Shared exclusions
drop HTTP facts whose operation is in an excluded file. Duplicate primary keys
and malformed JSON are rejected before core reconciliation. Diagnostic
locations are preserved when ordering and removing duplicate messages.

Language-specific project rules stay inside the scanner. The scanner registry
loads every enabled module through the same contract, and core applies the rules
in the [scanner overview](index.md). A scanner must include a fixture proving
deterministic output, atomic files, root membership, supported operation
evidence, and failure without partial output.

### HTTP endpoints and requests

A scanner without HTTP extraction omits `httpEndpoints` and `httpRequests`.
Each fact names the declared `operation` that handles or sends it;
[scanner evidence](evidence.md#http-endpoints-and-requests) defines the meaning.

- An endpoint has `method`, an uppercase method or `*`, and `path`. Its
  segments are `{ kind: 'literal', value }`, `{ kind: 'parameter', name }`,
  and `{ kind: 'catch-all', name }`. Parameters and catch-alls accept
  `optional: true`, and `constrained: true` when the application accepts only
  some of their values; a catch-all is the last segment. An endpoint whose
  router takes the first registered match also has
  `order: { application, position }`: the repository-relative path of the file
  that creates the application, or of the file that declares the route when
  the scanner cannot identify that file, and a nonnegative integer position in
  its registration sequence.
- A request has `path`, `method` only when it is known, and `configured: true`
  when the path follows a configuration value. Its segments are
  `{ kind: 'literal', value }`, `{ kind: 'dynamic' }` for one whole computed
  segment, and `{ kind: 'unknown' }` for text that is not fully proven,
  including a base that states a host or cannot be resolved.

Literal values and names are nonempty RFC 3986 path characters, so a segment
never contains `/`, a query, or a fragment. Omit empty segments. For a route
`/api/talks/{id}` handled by `show`, and `fetch(API_URL + '/talks/' + id)` in
`load`, where `API_URL` comes from configuration:

```json
{
  "httpEndpoints": [{
    "operation": "show", "method": "GET",
    "path": [
      { "kind": "literal", "value": "api" },
      { "kind": "literal", "value": "talks" },
      { "kind": "parameter", "name": "id" }
    ]
  }],
  "httpRequests": [{
    "operation": "load", "method": "GET", "configured": true,
    "path": [{ "kind": "literal", "value": "talks" }, { "kind": "dynamic" }]
  }]
}
```

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
