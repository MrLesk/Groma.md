# Go scanner

The Go plugin loads the selected project through Go's package and type tooling,
then supplies source and operation evidence to Groma's shared scan lifecycle.
The current qualification target is [Chi v5.2.1](https://github.com/go-chi/chi/tree/v5.2.1),
commit `71307f9b7e4e9527638bc951c42b782cd1560331`, using Go 1.27.1 on macOS arm64.

This is a private, locally built package. No public Go scanner version or
cross-platform qualification is claimed here.

## Install and scan

Install Go 1.27.1 and put its `bin` directory on `PATH`. Prepare the project's
dependencies and generated source using its own build instructions.
For ordinary module dependencies, the preparation command is `go mod download`.

A maintainer builds the plugin once:

```sh
cd plugins/scanners/go/worker
go mod download
cd ../../../..
bun plugins/scanners/go/build.ts
```

The output `plugins/scanners/go/dist/package` contains a bundled JavaScript
adapter, native worker, manifest, and licenses. It has no installation scripts
or runtime dependency on scanner source. The build targets the maintainer's
host operating system and architecture. The worker uses
`golang.org/x/tools v0.49.0`; project loading still requires the installed Go
toolchain.

From the selected Go module root:

```sh
groma init 'My project' --directory groma
groma scanner add /absolute/path/to/built/package
groma scanner setup
groma scan
```

`scanner setup` calls the shared readiness hook. It reports a missing worker,
missing Go installation, unsupported project root, or missing project
preparation. Scan runs the same check. Neither command installs tools or
downloads dependencies: the adapter sets `GOTOOLCHAIN=local`,
`GOPROXY=off`, and `GOSUMDB=off`, and uses `-mod=readonly`.
Go may use its normal compiler cache.

## Supported context and evidence

The approved example is Chi's root pure-Go module in the default host build
context. `go/packages.Load` loads `./...` with typed syntax and module
information; Go owns file membership, imports, dependencies, and symbol
resolution. Tests are excluded. Nested example modules, directories excluded
by Go's package patterns, and inactive platform/build-tag files are not
inventoried. Workspaces are not supported; an active workspace produces a
scope error. Custom build contexts, cgo, custom package drivers, and other
module layouts have not been qualified.

Each active physical source file has one placement in its loaded package.
Package imports between loaded packages are temporary dependency evidence.
The scanner reports top-level declarations, function and method bodies,
closures, and package variable initializers containing calls.
`go/types` and
[`typeutil.StaticCallee`](https://pkg.go.dev/golang.org/x/tools/go/types/typeutil#StaticCallee)
supply canonical static targets. Imported aliases resolve to the implementation.
Executable wrappers remain operations. An immediately invoked closure owns
its body calls.

Interfaces, function-valued fields or variables, returned function values,
and providers outside the selected module remain unresolved.
There is no callback-binding propagation, framework relationship inference,
body-token comparison, or execution-order model. Builtins and type conversions
are not source operation calls. Source offsets are zero-based UTF-16 positions
for the shared contract.

These facts do not define new OKF concepts or C4 levels. Packages are initial
placement evidence, not proof of deployment boundaries. Core preserves curated
file ownership, waits for all enabled scanners to succeed, and writes the
existing Markdown Code links and selected relationships. Ordinary Markdown
readers can follow those links and read authored responsibilities. Groma
interprets file ownership and its existing relationship sections.
The current shared rule does not turn ordinary Go calls into map arrows.

This boundary is language-independent: compiler tools own language meaning;
the common lifecycle owns architecture. The current implementation and
qualification remain deliberately limited to the approved project.

## Validation

Run the independent fixture and compiled consumer checks with the installed
Go executable:

```sh
GROMA_TEST_GO="$(command -v go)" bun test test-bun/go-scanner.test.ts
bun plugins/scanners/go/build.ts
bun plugins/scanners/go/smoke.ts /absolute/path/to/compiled-groma plugins/scanners/go/dist/package
```

Native fixture tests are opt-in through `GROMA_TEST_GO`; the missing-tool
readiness test runs without Go. Release qualification must enable the native
tests and run the compiled consumer on each declared platform.

Local verification on macOS arm64:

- Independent fixture: deterministic observations, imported alias identity,
  concrete methods, wrapper and closure ownership, uncertain dispatch, UTF-16
  positions, and failed compilation/preparation without module-file changes.
- Compiled consumer: relocated source-free package, readiness, mixed Go and
  TypeScript ownership, repeat scans, curated ownership after a source edit,
  and a failed scan leaving the prior map unchanged.
- Chi: 35 active files, 240 operations, and 559 invocations; 205 have concrete
  module-local targets and 354 remain unresolved. Repeated scans preserve
  curated Markdown. A temporary source edit preserves the owner and authored
  responsibility; a failed scan preserves the full previous map.

The Chi map is scan evidence with one reviewed request-dispatch responsibility,
not a claim of complete architectural curation or automatic HTTP relationships.
Human map review and final platform/publication qualification are separate
acceptance gates.

## Research provenance

The fetched `research/go-scanner-prototype` branch still ended at preparation
commit `87bcdef`. Its only workflow artifact contained development tools,
source checkout, and pinned evaluation repositories. The research task
reported a local prototype checkpoint but stated that source publication was
interrupted. Its recovery archive was not accessible through the available
task attachment or browser session.

This implementation reuses the recorded compiler-backed design and pinned Chi
example; it does not claim to reuse unavailable source or to validate the old
checkpoint. The old report's 36-file inventory included inactive build
variants. The current approved host context contains 35 active files.
