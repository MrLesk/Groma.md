# C#/.NET scanner prototype

The optional C# scanner uses Roslyn 5.9 and MSBuild. It scans a selected, trusted
SDK-style C# project graph and supplies temporary source evidence to Groma core.
This branch is a review prototype, not a published or production-certified package.
See [production readiness research](production-readiness.md) for the support
matrix, architectural interpretation, installation decisions and release gates.

## Prepare the review package

In the Groma checkout, with Bun 1.4.1 and a .NET 10 SDK:

```sh
bun install --frozen-lockfile
dotnet restore plugins/scanners/csharp/dotnet/Groma.CSharpScanner.csproj --locked-mode
bun scripts/package-csharp-scanner.ts
```

The output is `dist/csharp-scanner-package`. Its bundled JavaScript entry and
published managed worker are relocatable. Roslyn's BuildHost directories,
`.deps.json` and `.runtimeconfig.json` must travel with the worker. No workspace
package or TypeScript installation is required by this scanner package.
The script does not publish to npm. Use Groma built from this branch to access
its new explicit setup command.

## Enable it in a target repository

```sh
groma scanner add /absolute/path/to/dist/csharp-scanner-package
groma scanner setup csharp --
groma scan
```

The first command only enables the module. Setup checks dependencies; it does
not download or restore unless explicitly requested. On a machine without .NET,
the prototype can install SDK **10.0.400** privately and restore a trusted project:

```sh
groma scanner setup csharp -- --install-sdk --restore --trust-project
```

The SDK archive comes from Microsoft's release service and is checked against
its SHA-512 before extraction. The SDK is installed under
`~/.groma/cache/csharp/10.0.400/<rid>` without administrator privileges, PATH
changes or edits to `global.json`. `GROMA_CSHARP_CACHE` changes that cache root.
`DOTNET_HOST_PATH` explicitly selects an existing host and takes precedence when
scanning. Do not combine a conflicting host override with private installation.

The managed worker needs a .NET 10 runtime. **The project's SDK is a separate
requirement:** its `global.json` selection is respected. The private bootstrap
currently installs only 10.0.400; it does not satisfy a repository pinned to a
9.x SDK. Use an existing dotnet installation containing that project SDK and a
.NET 10 runtime, or install those versions explicitly outside this prototype.
Operating-system native prerequisites, proprietary feeds, credentials and .NET
workloads are not installed automatically.

**Trust boundary:** scanning opens MSBuild projects. Project imports, tasks and
source generators can execute code, even without an application build. Scan only
trusted repositories. The scanner itself never invokes restore or downloads
during scan/watch; that is not a sandbox or a guarantee that project build logic
cannot access the network. The explicit restore command uses the repository's
normal NuGet configuration and may access its configured feeds.

## Select the analysis scope

Exactly one root `.sln` or `.slnx` takes precedence over root projects. Otherwise
there must be exactly one root `.csproj`. Ambiguous inputs require a selection;
there is no alphabetically-first fallback. For a nested input, create
`groma.csharp.json` at the repository root:

```json
{
  "input": "src/Service/Service.csproj",
  "configuration": "Debug",
  "maxProjects": 128,
  "maxFiles": 20000,
  "timeoutSeconds": 120
}
```

Only `input` needs to be specified; the other values shown are defaults. The
selected project's transitive source project references remain in scope when
inside the repository. All emitted paths are repository-relative, including
sibling sources. Scopes are placement evidence, not asserted runtime containers.

The prototype rejects mixed-language or legacy projects, unsupported SDK
headers, multiple loaded target-framework contexts for a project, and one
physical file included in several loaded projects. A linked file used by only
one selected project is supported. Select a smaller project graph rather than
merging incompatible compilation contexts. Standard `.NET`, `Web` and `Worker`
SDK headers are accepted; workload-specific semantics are not certified.

Workspace failures, compiler errors, out-of-root source graphs and exceeded
budgets produce no observation. Core therefore preserves the existing map.
Package-free SDK projects can bind without an assets file: restore is required
when their actual dependencies require it, not as a mandatory ritual.

## Evidence and limitations

Every physical C# source file is atomic, including separate partial declarations.
Project scopes and references, declared types, resolved file dependencies,
implemented operations and explicit calls/constructions are reported. Canonical
calls support aliases, overloads, generics, extension methods and partial method
implementations. Local functions, executable lambdas, accessors and top-level
statements have their own callers; expression-tree bodies and `nameof` are not
reported as immediately executing calls.

Interface, overridable virtual, delegate, dynamic and external targets remain
unresolved where concrete providers cannot be established. Generated sources
may contribute semantic input but are not primary physical-file records.
Implicit operators, property/event dispatch, initializers, receiver/delegate
value flow, DI registrations and HTTP/message/ORM framework wiring are outside
the implemented operation extraction. No normalized body tokens are emitted.

Direct calls are evidence, **not automatically map relationships**. Core's
existing reviewed selection rule remains unchanged. This prototype emits no
concrete callback binding facts, so it does not yet reproduce TypeScript's
supplied-named-callback relationship inference for C# applications.

Source, project, solution, `.props`, `.targets`, `global.json`, `NuGet.Config`,
`packages.lock.json` and scanner-config changes invalidate scans; `bin` and
`obj` do not. AdditionalFiles, Razor/XAML and arbitrary external imports need a
later dependency-aware watch design. Each refresh is a complete new process,
not an incremental Roslyn workspace. Project/file budgets reject oversized
observations but do not prevent every allocation while loading MSBuild; timeout
and 128 MiB output bounds are failure limits, not memory guarantees.

## Validation

```sh
dotnet test plugins/scanners/csharp/dotnet/test/Groma.CSharpScanner.Tests.csproj
bun run check
bun run build
bun scripts/package-csharp-scanner.ts
bun scripts/validate-csharp-package.ts dist/groma dist/csharp-scanner-package
```

Use `dist/groma.exe` on Windows. The package validation copies the binary,
package and fixture outside the checkout, performs setup and scans, verifies
repeatable evidence, and checks that a failed scan leaves architecture unchanged.
Set `GROMA_CSHARP_TEST_INSTALL=1` only when explicitly testing private SDK download.
