# C# scanner

The optional `@groma/scanner-csharp` package uses a prebuilt Roslyn worker and the project's installed .NET SDK. Install the package in Groma, select the project, restore it with normal .NET tooling, then scan. Scanning never installs an SDK, builds the worker, or restores packages.

## Tooling and preparation

The worker requires the .NET 10 runtime. Its Roslyn dependencies are 5.9.0 and MSBuild Locator is 1.11.2. The project separately requires the SDK and reference packs selected by its `global.json`. Both may be installed together: running the worker on .NET 10 does not select SDK 10 for the project.

Use `dotnet` on PATH, or set `DOTNET_HOST_PATH` to the installed dotnet executable. The scanner uses the selected input directory for SDK lookup. [Microsoft's SDK selection documentation](https://learn.microsoft.com/en-us/dotnet/core/versions/selection) explains how `global.json` is found. An unavailable pinned SDK fails instead of using a different SDK.

For a nested project, create `groma.csharp.json` at the repository root:

```json
{ "input": "src/Library/Library.csproj" }
```

Run `dotnet restore Library.csproj` from that input directory, then run `groma scan` from the repository root. Restore uses the project's normal NuGet settings and credentials. On macOS, use a relative restore input from its directory so `/var` and `/private/var` aliases do not enter one restore graph as separate project paths.

Install a prepared local package with `groma scanner add /path/to/csharp-scanner-package`. Release publication is separate from local qualification. The package also exports `checkCSharpReadiness(repositoryRoot)`, used through the same input/tool checks as scanning. It returns the selected input and SDK version; successful readiness does not prove dependency restore or compilation. A missing worker means the package needs preparation; missing tooling or compilation errors must be fixed before scanning can replace architecture evidence.

## Supported input and evidence

The selected qualification example is FluentValidation 12.0.0, commit `5365d9294812c8a5c5a7f4d7447c9a65b79a025b`, selecting `src/FluentValidation/FluentValidation.csproj` with its original SDK selection. Minimal fixtures also exercise in-repository project references and the standard Web SDK header.

Inputs are SDK-style `.csproj`, `.sln`, and `.slnx` files. When input is omitted, one root solution takes precedence over root projects. Multiple candidates require explicit selection. Standard .NET, Web and Worker SDK project headers are accepted, but this is not general framework qualification. Mixed-language graphs, legacy project formats, multiple target-framework contexts, and a file shared by multiple loaded project contexts are rejected.

Each physical C# source has one inventory record. Generated `bin` and `obj` sources are excluded. Roslyn resolves overloads, generic methods, extensions, partial implementations and direct calls. Virtual, interface and delegate dispatch retain uncertainty where the runtime provider is not established. Implicit calls, initializers, generated operations, receiver/delegate value flow, dependency injection and network protocols are not resolved.

Source relationships and operations are temporary evidence. They are not C4 components or proof of business collaborations. Core owns curated source membership and relationship selection; ordinary Markdown readers retain readable descriptions and links under the existing OKF application profile. This plugin introduces no architecture metadata or map level.

Configuration also accepts `configuration` (default `Debug`), `maxProjects` (128), `maxFiles` (20000), and `timeoutSeconds` (120). Exceeded limits fail the scan; they never publish truncated evidence. Any enabled scanner failure prevents reconciliation and preserves the prior map.

## Contributor package build

With .NET 10 SDK installed, restore `plugins/scanners/csharp/dotnet/Groma.CSharpScanner.csproj`, then run:

```sh
bun scripts/package-csharp-scanner.ts
bun scripts/validate-csharp-package.ts dist/groma dist/csharp-scanner-package
```

The build bundles the adapter and publishes a framework-dependent worker into the package. It has no installation scripts and does not include a private SDK. Run the Roslyn tests with `dotnet test plugins/scanners/csharp/dotnet/test/Groma.CSharpScanner.Tests.csproj` and adapter tests with `bun test test-bun/csharp-scanner.test.ts`.
