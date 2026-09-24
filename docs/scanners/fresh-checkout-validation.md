# Fresh-checkout scanner validation

Validated on macOS arm64 on 2026-09-15 for TASK-396. These are local source
and package checks, not a published release or qualification of other platforms.

## Installed packages

All nine staged packages were copied outside the groma.md checkout and scanned
independent fixtures. Each child process had an empty home directory and only
Git on PATH. The fixture contained no installed project dependencies, restored
packages or generated build output. The harness rejected JavaScript network
fetches. Each scanner returned declarations, operations and calls; all except
the syntax-only Python scanner retained proven local targets. Repeated results
were identical and the fixture bytes were unchanged: 9 tests, 71 assertions.

```sh
GROMA_TEST_PACKAGES=/path/to/staged-packages bun test --timeout 60000 test-bun/scanner-fresh-checkout.test.ts
```

Additional domain tests cover React, Vue and Angular callbacks without
`node_modules`, Java missing-type uncertainty, Go local calls, Rust module and
method resolution, and C# overloads, extensions and partial implementations.
C# fixtures run without `dotnet restore`. The .NET runner itself uses a local
communication socket; it requires permission to open that socket.

## callforpapers

A disposable source-only copy of revision
`1cb6783f3379664e3f176e72c5419064ce24dbfd` was scanned with the packaged Java,
TypeScript and Angular scanners. There was no `node_modules`, prepared Maven
cache or language tool on PATH. No project build or dependency install ran.

The combined result contains 665 Java files, 530 TypeScript files and 195 HTML
templates: 1,390 unique file owners, 1,394 architecture elements and 1,397
Markdown files. The 47 Angular relationship rows match the earlier prepared
checkout. The company-merge dialog still supplies `merged`, `cancelled` and
`error` callbacks to the company-list component. Inline-template child components
can supply outputs to an external parent template; scanning inline parent
bindings remains outside the supported extraction.

Two final scans took 5.09 and 4.76 seconds. Every architecture Markdown file was
byte-identical between runs; project source and dependency declarations were
unchanged. Existing framework fixtures also verify curated ownership and
preservation of authored architecture.

Missing external Java definitions become one summary diagnostic and uncertain
calls. They do not prevent inventory or local call evidence. Diagnostics are
indexed by source file so checking individual calls does not repeatedly search
all project errors. This scan reports missing-type limitations; it does not
claim that the application compiles or that Spring injection and HTTP wiring
are inferred.

## Delivery

Java includes a compiler runtime; C# includes a self-contained .NET runtime.
Python includes Pyodide 314.0.7 with CPython 3.14.2 and the standard library.
Go, Rust and TypeScript include their native analysis workers. Framework
packages include their compiler libraries. Runtime licenses and notices travel
with the packages. Release CI assembles platform assets and runs the same
fresh-checkout package suite on each build host before publication.

The required `bun run check` covers lint, types, Node tests and Bun tests.
The cold simplicity review passed. It led to removal of unused Java build-input
arguments and duplicate Go sorting. Scanner execution changes add no OKF
metadata or C4 levels; the existing core still owns architecture meaning.

The final repository check passed 16 Node tests and 317 Bun tests. Its 15 skipped
opt-in tests include the separately executed package, Go and Rust suites. The
seven C# tests also passed. Both required reviews passed without remaining
blockers. C# self-contained builds keep runtime-specific restore state in build
output; the shared dependency lock still passes locked restore after publishing.
