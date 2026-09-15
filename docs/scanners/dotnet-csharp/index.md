# C# scanner

The C# scanner bundles Roslyn and a self-contained .NET runtime. Install the
scanner and scan source without a project SDK, NuGet restore, generated output
or application build. `global.json` does not select the scanner's runtime.

```sh
groma scanner add @groma/scanner-csharp
groma scan
```

Maintainers build the package with the .NET 10 SDK and Bun:

```sh
bun scripts/package-csharp-scanner.ts
```

The package includes the executable worker, runtime, adapter and upstream
notices. Its consumer does not need `dotnet` or an installation script.

## Source inputs

The scanner discovers tracked and unignored SDK-style `.csproj`, `.sln` and
`.slnx` files. Solutions are selected before their projects; local project
references are loaded once. Set `settings.input` on the existing C# scanner
entry to select one project or solution relative to the repository root.

An in-memory Roslyn workspace reads project XML and authored C# files.
Unconditional language options, compile includes/removes, implicit usings and
local project references supply context. The scanner's runtime supplies base
.NET declarations. It does not run MSBuild, evaluate imported or conditional
build settings, restore packages, or execute source generators. Standard .NET,
Web and Worker SDK headers are accepted; this is not general framework analysis.

Generated `bin` and `obj` files are excluded. A physical source file cannot
belong to several selected project contexts. Project references must stay
inside the repository. Mixed-language graphs and legacy projects are unsupported.
Invalid syntax fails a scan. Missing external types produce diagnostics while
local declarations and supported operations remain available.

## Evidence

Roslyn resolves local overloads, generic methods, extensions, partial
implementations and direct calls. Calls with type errors, virtual dispatch,
interfaces and delegates retain uncertainty. Implicit calls, initializers,
generated operations, receiver/delegate value flow, dependency injection and
network protocols are not resolved.

Solutions and projects supply source roots and file membership. They are not
C4 components or proof of business collaborations. Core owns curated membership
and relationship selection; ordinary Markdown readers see the existing OKF
records and Code links. The scanner adds no map level or architecture metadata.

Settings also accept `configuration` (default `Debug`), `maxProjects` (128),
`maxFiles` (20000) and `timeoutSeconds` (120). Configuration selects the source
DEBUG/TRACE symbols; it does not execute a build configuration. Limits fail
rather than publish truncated evidence. Failed scanners retain their saved
evidence while other scanners can update the map.

Run `dotnet test plugins/scanners/csharp/dotnet/test/Groma.CSharpScanner.Tests.csproj`
for Roslyn tests. Fixtures are scanned without restore. The packaged test
removes language tools from PATH; see
[fresh-checkout validation](../fresh-checkout-validation.md).
