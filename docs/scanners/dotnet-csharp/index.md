# C# scanner

The optional `@groma/scanner-csharp` package uses a prebuilt Roslyn worker and the project's installed .NET SDK. Install the package in Groma, select the project, restore it with normal .NET tooling, then scan. Scanning never installs an SDK, builds the worker, or restores packages.

## Tooling and preparation

The worker requires the .NET 10 runtime. Its Roslyn dependencies are 5.9.0 and MSBuild Locator is 1.11.2. The project separately requires the SDK and reference packs selected by its `global.json`. Both may be installed together: running the worker on .NET 10 does not select SDK 10 for the project.

Use `dotnet` on PATH, or set `DOTNET_HOST_PATH` to the installed dotnet executable. The scanner uses the selected input directory for SDK lookup. [Microsoft's SDK selection documentation](https://learn.microsoft.com/en-us/dotnet/core/versions/selection) explains how `global.json` is found. An unavailable pinned SDK fails instead of using a different SDK.

For a nested project, set `settings` on the existing `csharp` entry in the
shared `scanners.json` inside `groma/` or `.groma/`. Preserve its installed source:

```json
{
  "id": "csharp",
  "source": "./tools/csharp-scanner-package",
  "settings": { "input": "src/Library/Library.csproj" }
}
```

When `input` is omitted, the scanner selects a single root solution, or a
single root project when no solution exists. Multiple candidates require an
explicit `settings.input`. Paths are relative to the repository root. Run a
new scan or restart the active viewer or watch session after editing settings.
See the [shared configuration contract](../creating-a-plugin.md#scanner-settings).

Run `dotnet restore Library.csproj` from that input directory, then run `groma scan` from the repository root. Restore uses the project's normal NuGet settings and credentials. On macOS, use a relative restore input from its directory so `/var` and `/private/var` aliases do not enter one restore graph as separate project paths.

Install a prepared local package with `groma scanner add /path/to/csharp-scanner-package`. Release publication is separate from local qualification. The package also exports `checkCSharpReadiness(repositoryRoot, { input })`, used through the same input/tool checks as scanning. It returns the selected input and SDK version; successful readiness does not prove dependency restore or compilation. A missing worker means the package needs preparation; missing tooling or compilation errors must be fixed before scanning can replace architecture evidence.

## Supported input and evidence

The selected qualification example is FluentValidation 12.0.0, commit `5365d9294812c8a5c5a7f4d7447c9a65b79a025b`, selecting `src/FluentValidation/FluentValidation.csproj` with its original SDK selection. Minimal fixtures also exercise in-repository project references and the standard Web SDK header.

Inputs are SDK-style `.csproj`, `.sln`, and `.slnx` files. When input is omitted, one root solution takes precedence over root projects. Multiple candidates require explicit selection. Standard .NET, Web and Worker SDK project headers are accepted, but this is not general framework qualification. Mixed-language graphs, legacy project formats, multiple target-framework contexts, and a file shared by multiple loaded project contexts are rejected.

Each physical C# source has one inventory record. Generated `bin` and `obj` sources are excluded. Roslyn resolves overloads, generic methods, extensions, partial implementations and direct calls. Virtual, interface and delegate dispatch retain uncertainty where the runtime provider is not established. Implicit calls, initializers, generated operations, receiver/delegate value flow, dependency injection and network protocols are not resolved.

Solutions and projects are source roots, with each project linked to its solution
when a solution is selected. File records identify their project root. A directly
selected project and its loaded project references are top-level source roots.
Root membership and operations are temporary evidence. They are not C4 components or proof of business collaborations. Core owns curated source membership and relationship selection; ordinary Markdown readers retain readable descriptions and links under the existing OKF application profile. This plugin introduces no architecture metadata or map level.

`settings` also accepts `configuration` (default `Debug`), `maxProjects` (128), `maxFiles` (20000), and `timeoutSeconds` (120). Exceeded limits fail the scan; they never publish truncated evidence. Any enabled scanner failure prevents reconciliation and preserves the prior map.

## Contributor package build

With .NET 10 SDK installed, restore `plugins/scanners/csharp/dotnet/Groma.CSharpScanner.csproj`, then run:

```sh
bun scripts/package-csharp-scanner.ts
```

The build bundles the adapter and publishes a framework-dependent worker into the package. It has no installation scripts and does not include a private SDK. Run the Roslyn tests with `dotnet test plugins/scanners/csharp/dotnet/test/Groma.CSharpScanner.Tests.csproj`.

## Nested projects

From the repository root, the scanner finds tracked and unignored `.sln`, `.slnx`
and `.csproj` files. Solutions are loaded first. Project roots returned by Roslyn
prevent a solution member or project reference from being scanned again as a
standalone input. Independent projects are scanned as additional inputs. Each
input selects its own installed SDK; all evidence paths stay relative to the
repository. `settings.input` still selects one explicit solution or project.
Any selected input failure fails the complete scan.
