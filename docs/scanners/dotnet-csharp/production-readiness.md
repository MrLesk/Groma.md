# Production C#/.NET scanning: research and prototype

Research baseline: Groma `0e1252c92a90ef87b30d4fb5cfa56e768d436fea`.
Review work: TASK-324, `research/csharp-scanner-prototype`.
The recommendations below distinguish implemented behavior, measured experiments,
and release requirements. This is not a claim of production certification.

## Decision

Use **Roslyn plus MSBuildWorkspace in an out-of-process, prebuilt managed worker**.
Keep the existing language-neutral scanner contract and core's architecture
selection policy. Ship the worker as an optional scanner package, not inside
all Groma binaries. Install dependencies only through an explicit setup action.

Start with trusted, standard SDK-style C# project graphs, one loaded compilation
context per physical project, and a selected repository-contained input.
Concentrate on correct inventory and provider evidence before adding DI,
framework protocols or an impressive-looking but unjustified relationship graph.
Do not make a syntax-only fallback look like a successful semantic scan.

The main discovery is not that C# needs another parser: **the unit of analysis
is a configured compilation, while Groma's durable unit of ownership is a
physical file**. SDK selection, conditional compilation, linked files,
source generators and runtime dispatch all make that distinction important.

## What Groma actually expects

The [scanner contract](../creating-a-plugin.md), [evidence semantics](../evidence.md)
and [relationship policy](../../relationship-inference.md) establish these boundaries:

| Layer | Responsibility |
| --- | --- |
| Language scanner | Inventory physical files and declarations; understand project membership; resolve supported source operations; retain uncertainty and diagnostics. |
| Scanner lifecycle | Load explicitly configured modules; gather every complete observation; fail before reconciliation if any enabled scanner fails. |
| Core | Preserve curated file ownership; place unknown files; assign architecture IDs; select supportable interactions; reconcile Markdown atomically at the complete-observation boundary. |
| People and agents | Explain business responsibilities, correct boundaries and author interactions whose meaning cannot be inferred from supported evidence. |

An observation contains root and engine identity, scopes, atomic files,
placements, source relationships and diagnostics. Optional operations and
invocations identify executable providers and their unresolved alternatives.
A scanner does not read architecture descriptions or invent C4 IDs. An assembly,
namespace, directory or project is not automatically a runtime container.

`complete: true` means complete **within the scanner's declared extraction and
input scope**. It does not mean every runtime interaction is known. A failed,
timed-out or truncated scan must not remove the previous map's evidence.

The current shared contract permits exactly one placement per physical file.
It has no first-class target-framework/configuration dimension or external
package endpoint. Do not shoehorn several compilations into one apparently
unambiguous provider. This prototype rejects conflicting loaded contexts.

The TypeScript scanner has more than dependency extraction: it follows certain
immutable callback bindings. Core currently emits a derived map statement only
for a **concretely supplied named callback**, with a resolved provider-owner set.
Ordinary calls, imports, type uses and project references are not automatically
architectural collaborations. The C# prototype preserves that policy and does
not yet emit concrete callback `binding` facts. Consequently, its operation
evidence does not by itself produce C# service-interaction rows on the map.
That is an explicit limitation, not a reason to reinterpret every call as a
business relationship.

## Audit of the previous C# draft

The draft already used the right foundation: Roslyn semantic models,
MSBuild projects, atomic partial-declaration files, project placement, shared
contract validation and one JSON response after a successful scan.

Its production gaps were material. The adapter built the scanner every time,
allowing implicit package restore on scan/watch and requiring the source tree.
It chose the alphabetically first root solution or project, ignored nested
selection and new solution formats, and watched too few configuration files.
The worker used the selected input directory as the repository root, dropping
sibling project sources. It checked workspace failures but not compilation
errors. It had no operation evidence or explicit resource bounds.

A controlled reproduction found a more subtle correctness bug. A project with
`TargetFrameworks=net10.0;net10.0-windows` and a `#if WINDOWS` declaration produced
both the portable-only and Windows-only types in one complete file observation,
under one scope. That is not a single compilation's architecture. The revised
worker rejects multiple loaded contexts rather than unioning their symbols.
The regression test preserves this example.

## Recommended first-release support boundary

“Supported C#” must be a matrix of input, project system, platform, configuration
and evidence capability—not just recognition of `.cs` files.

| Project or feature | Prototype / initial release recommendation |
| --- | --- |
| SDK-style class libraries and console applications | Primary scope. Use the evaluated source project-reference graph, not every `.cs` file found recursively. |
| ASP.NET Core and Worker SDK headers | Accepted; a minimal Web SDK/framework-reference/top-level-entry fixture is tested. This does not certify every ASP.NET feature or Worker deployment. |
| Modern `.sln`, `.slnx`, selected nested `.csproj` | Implemented. Ambiguous root inputs require explicit configuration. |
| Single-target projects targeting modern .NET | Primary scope, subject to installed SDK/reference packs and successful compilation. SDK version and target framework are independent. |
| Multi-target libraries | Multiple loaded contexts are rejected. A later reviewed context model or explicit target-selection design is required; no silent “first TFM” policy. |
| Partial types and partial methods | Physical declaration files stay separate. Implemented partial methods are canonical call targets. |
| A source file linked into one selected project | Supported inside the repository. One file shared by several loaded project contexts is rejected because placement and semantics can conflict. |
| NuGet/private feeds/central package management | Respect evaluated project configuration. Restore is explicit; credentials remain with the user's normal NuGet tooling. No credential capture or rewriting. |
| Source generators | May contribute compiler input; physical generated documents are not primary map files. Generated-provider and generator-diagnostic coverage needs separate release qualification. |
| Razor/Blazor/XAML/WPF/WinForms/MAUI/Avalonia | Not certified by this prototype. A recognized SDK header alone is not full framework support; markup-generated behavior and workloads need their own fixtures and scope contracts. |
| Legacy .NET Framework/non-SDK projects, old ASP.NET, COM | Excluded initially. The .NET-hosted MSBuild locator is not a universal substitute for Visual Studio/full-framework MSBuild and targeting packs. |
| Unity, Xamarin, custom build SDKs, source generators with native dependencies | Excluded or experimental until dedicated project-system adapters and deployment tests exist. |
| F#, VB and mixed-language solutions | Rejected. A separate scanner or explicit language boundary is preferable to silently omitting projects. |
| `.slnf`, loose `.cs` scripts, notebook/file-based app inputs | Not implemented. Select a supported project; do not pretend loose syntax analysis is an evaluated project scan. |
| Native AOT/trimming/single-file application publishing | The application's deployment choice is not evidence of runtime behavior. Ordinary supported source projects can still be analyzed, but deployment-specific generated paths are not inferred. |

Microsoft's [SDK overview][sdk] explains implicit source items and imports.
The [MSBuild locator guidance][locator] explains the difference between .NET SDK
and Visual Studio installations. These are why a manual XML/source glob parser
would be an inadequate replacement for the workspace.

## How relationships should be identified

### Keep four different claims separate

A **project reference** is build/source-graph evidence. A **type or member use**
is a source dependency. A **canonical invocation target** identifies executable
work within the supported analysis. A **runtime or business collaboration**
requires additional wiring and interpretation. These are not interchangeable
confidence levels and should not be collapsed into a numeric score.

For example, `Orders` referencing `Contracts` does not prove an HTTP call.
A controller declaring `IRepository` does not prove which repository implementation
is supplied. A `using` directive names an importable scope; it is not a call.
Static analysis may correctly identify a call which is never reached at runtime.

### Roslyn extraction choices

Use semantic symbols for identity, not member spelling. Overloads, aliases,
generic instantiations and reduced extension methods must resolve to their
original implementation. Partial method definitions must resolve to the
implementation file. Preserve executable wrappers: a method that forwards to a
provider is still an operation, not an identity-preserving alias.

The prototype uses explicit invocation/construction syntax with Roslyn's
[`IInvocationOperation`][invocation] and [`IMethodSymbol`][method]. It emits
implemented methods, constructors, operators, accessors, local functions,
executable lambdas and top-level entry operations. It does not emit abstract
or interface signatures as if they were executable implementations.

| C# construct | Evidence policy |
| --- | --- |
| Static/nonvirtual direct call | Canonical in-scope implementation when established; otherwise unresolved. |
| Overload, generic method, alias or extension call | Compiler-selected symbol, canonicalized; never name-only matching. |
| Partial method | Implementation declaration, not the signature-only part. |
| Virtual dispatch | Retain a known declaration candidate but mark unresolved when overriding targets may exist. A sealed method/type or nonvirtual base dispatch can narrow the supported target. |
| Interface dispatch | A type signature or implementation list does not establish receiver identity. Preserve unresolved dispatch rather than choosing every implementation or the only visible one. |
| Delegate/event call | Requires value origins and mutation/lifetime reasoning; unresolved in this prototype. Merely registering a handler is not dispatch. |
| Lambdas/local functions | Separate caller operations; do not attribute their bodies to the enclosing method. An expression tree describes code and is not an immediately executed lambda body. |
| `nameof`, attributes, generic constraints, inheritance | Some are type/source evidence, not ordinary runtime invocations. `nameof` is not emitted as a call. |
| External/generated provider | No fabricated file endpoint. The current operation contract has in-observation targets only, so preserve uncertainty. |
| `dynamic`, reflection, expression compilation | Unresolved without separately supported analysis; absence of a target is not proof of no interaction. |

Implicit property/event accesses, overloaded operators invoked through syntax,
`await`/enumeration/disposal patterns, initializers and primary-constructor
initialization are not all covered by the explicit-call extractor. These limits
are reported in diagnostics. Complete language semantics require more than
visiting `InvocationExpressionSyntax`. No normalized operation-body tokens are
provided yet, so C# duplicate-operation findings are also a later capability.

### Framework wiring is a second phase, not a name heuristic

For Microsoft.Extensions.DependencyInjection, model verified registration and
resolution semantics before deriving providers. Open generics, keyed services,
multiple registrations, `IEnumerable<T>`, factories, decorators, scopes,
conditional registration and alternate containers all matter. A service's
lifetime does not identify its architectural owner. Follow concrete receiver
origins where possible, retain unknown alternatives, and test against
[documented DI behavior][di]. Do not select implementations by suffixes such as
`Service`, `Repository` or `Controller`.

Minimal APIs/MVC endpoints need route composition, groups, HTTP verbs and
application identity. An `HttpClient` call needs its configured base address,
relative route and client identity; equal route strings alone are insufficient.
MediatR, Orleans, MassTransit, EF Core, gRPC and event buses each need explicit
registration/dispatch/protocol examples. The language plugin may extract those
facts, but core should own cross-language matching and architectural selection.
Add exchange fields only after a reviewed example demonstrates their necessity.

## Installation for a globally installed Groma

### Implemented review path

The [C# scanner guide](index.md) provides the exact contributor and target-repo
commands. A packaging script publishes the managed worker and bundles its
JavaScript adapter with the shared parser. The resulting package has no
`workspace:*` dependency and does not require a separately installed TypeScript
compiler, Node runtime or Bun executable when loaded by compiled Groma.

Groma's existing exact-version npm scanner cache remains the distribution
mechanism. Published packages must contain their usable worker and sidecars:
`scanner add` intentionally disables npm install scripts. This prototype adds
a minimal optional `ScannerPlugin.setup(root, args)` capability and
`groma scanner setup <id> -- [options]`; only that selected configured module
is loaded. Inventory remains nonexecuting and reports package presence rather
than pretending it has certified every project dependency.

For an eventual published version, the intended user sequence is:

```text
groma scanner add @groma/scanner-csharp@<exact published version>
groma scanner setup csharp -- --install-sdk --restore --trust-project
groma scan
```

The package above is **not published by this work**. Review uses the generated
local package directory. Installation, project restore and scanning are distinct
operations with distinct failure messages and trust implications.

### Runtime, SDK, reference packs and packages are separate dependencies

The prebuilt worker targets .NET 10. Running it requires that runtime. Opening
a project also requires a compatible MSBuild/project SDK selected under its
[`global.json` rules][global-json]. The project's target framework controls
reference assemblies, not which worker runtime is installed. NuGet dependencies,
platform workloads and operating-system native libraries are additional layers.

A self-contained worker would remove the worker-runtime requirement but not
the project SDK, targeting packs or workloads. It also multiplies platform
artifacts and payload size. A `dotnet tool` wrapper adds SDK/tool-resolution
requirements to an already global Groma installation. Neither is a universal
one-binary solution. Keeping a prebuilt managed worker and explicit SDK setup
is the smaller prototype; platform-specific self-contained workers remain a
release option after measurement. Do not trim or Native-AOT Roslyn/MSBuild by
default: dynamic loading and build-host dependencies need qualification.
See Microsoft's [single-file deployment guidance][single-file].

The prototype can explicitly download SDK 10.0.400 from Microsoft's
[release metadata][releases], verify the archive SHA-512, stage extraction and
rename into a private version/RID cache. It does not require admin privileges,
change global PATH, rewrite `global.json`, or download anything during scanning.
The checksum and archive share Microsoft's HTTPS trust root; this is not
independent artifact signing. Cache locking, resumable downloads, proxy/offline
mirrors, signing/provenance and comprehensive native-prerequisite checks remain
release work.

**Important limitation:** the private bootstrap installs only SDK 10.0.400.
It cannot satisfy a repository pinned to a 9.x SDK. The worker can use an
existing dotnet installation with the project's SDK plus a .NET 10 runtime.
Production setup should resolve and explain both requirements, install an
explicitly approved SDK set side by side, and fail clearly when proprietary
workloads or platform restrictions require the developer's normal toolchain.
It must not silently relax the repository's SDK pin.

## Security, correctness and failure policy

MSBuild evaluation/design-time builds, imports, tasks, SDK resolvers and source
generators can execute code. **No application launch is required for this to be
a code-execution trust boundary.** Microsoft's [MSBuild security guidance][security]
explicitly warns about untrusted project files. The scanner is for trusted
developer checkouts. A future isolated analysis service needs a real sandbox,
restricted credentials, network controls and resource limits; a child process
alone provides none of those guarantees.

The worker never calls `dotnet restore`; setup does so only with explicit
`--restore --trust-project`. Microsoft documents [implicit restore behavior][restore]
in normal build commands, which is why building the scanner during every scan
was wrong. Repository-controlled build logic can still make network requests:
“No scanner-initiated restore” is not “the process cannot use the network.”

Source references leaving the declared root fail instead of silently dropping
sibling files. The root check is a scope rule, not a symlink-proof security
boundary. Workspace errors, compiler errors, ambiguous contexts, output caps
and timeouts publish no observation. Successful package-free projects are
allowed without an assets file when the compiler has all needed references.
Missing package symbols fail rather than produce a degraded semantic map.

For production, add structured project/SDK/generator diagnostics, reliable
cancellation on every supported OS, protocol/output isolation from third-party
build tools, interrupted-install recovery and explicit coverage summaries.
Compiler warnings versus unavailable/generated semantic inputs require a
reviewed policy rather than either swallowing everything or rejecting all warnings.

## Large repositories and responsiveness

The prototype bounds requested/loaded project counts to 128, physical sources
to 20,000, worker output to 128 MiB, diagnostics to 1 MiB and a scan to 120 seconds
by default. Project/file/time limits are configurable. Exceeding a bound fails;
it never emits whichever subset happened to finish before a timer.

These are operational failure limits, **not a 20,000-file performance guarantee**.
MSBuild may allocate a large project graph before post-load limits can reject it.
There is no hard process-memory sandbox. A carefully selected `.csproj` is the
primary scope-control mechanism, with transitive references retained, not a
promise that its graph is small. More known target edges are not automatically
better architectural quality.

The first implementation scans projects sequentially within one complete
workspace and starts a fresh worker on every refresh. This avoids stale SDK
state and makes cancellation/failure boundaries understandable, but is unlikely
to meet subsecond watch latency on substantial solutions. Measure cold worker
startup, project evaluation, compilation/generators, extraction, serialization,
core reconciliation and viewer rendering separately. Do not compare a worker-only
benchmark with the TypeScript team's end-to-end painted-map timing.

A later long-lived worker should reuse immutable Roslyn solutions and invalidate
both edited projects and dependents. Cache keys need project inputs/imports,
SDK and engine versions, global properties, reference identities, assets,
central package versions, conditional symbols, generators and their inputs.
Caching solely by `.cs` modification time is incorrect. Memory budgets and
cancellation precede unconstrained parallel compilation. An explicit smaller
input is preferable to silently omitting tests or dependency projects by names.

Watch support now includes source/project/solution files, props/targets,
`global.json`, NuGet config/lockfiles and scanner configuration. Arbitrary
AdditionalFiles, external imports, markup and generated-input files need a
proper dependency-aware invalidation model before broad framework support.

## Validation and reproducibility

The checked-in minimal C# fixture covers two projects, aliases, overloads,
generics, extension methods, partial implementation targets, wrappers, virtual,
interface/delegate/dynamic/external dispatch, base calls, local functions,
lambdas, expression trees, `nameof`, accessors and top-level statements.
Additional controls cover Web SDK implicit framework references, missing SDK
pins, malformed compilation, multi-target conflicts, linked files, legacy inputs,
root boundaries, deterministic output and rejected resource-limit truncation.

The prototype at `fd56e71a17240a566afe9a0a33352a726f085f25` passed
repository checks, all 17 .NET tests and compiled-package relocation on Linux,
macOS and Windows. The Linux job also installed the private SDK and scanned
pinned FluentValidation 12.0.0. Its three complete observations were identical:
138 physical files, one project scope, 820 operations and 1,352 invocations,
including 590 resolved and 762 unresolved invocations. Fresh-worker scans took
6.27, 5.17 and 5.06 seconds on that runner. These are worker measurements, not
painted-map timings, an architectural precision score or a large-solution SLA.

The FluentValidation experiment retained its original source and SDK pin. It
used project SDK 9.0.317 while the worker ran on .NET 10, demonstrating why a
worker runtime and a project SDK must be treated separately. The linked
`src/CommonAssemblyInfo.cs` remained in the physical inventory. Source witnesses
confirmed a concrete constructor/method call and an overridable hook retained
as an unresolved candidate; counts alone would not establish this distinction.

A second pinned repository, eShopOnWeb, exercises a multi-project ASP.NET API
and a Web graph containing a Blazor project. The default restore succeeded,
but cached NuGet vulnerability warnings surfaced as MSBuild workspace failures,
so the scanner correctly published no complete observation under its current
failure policy. This is a real usability/release blocker, not a successful
application scan or a reason to suppress all workspace failures. An explicitly
labeled restore-policy control separates source-analysis capability from that
failure. Disabling package auditing in an experiment is not a security fix or
a recommended installation default; the original advisory logs are retained.

The [validation record](validation.md) gives exact repository and scanner
commits, workflow runs, commands, supported and rejected inputs, repeated-output
checks, source witnesses and measured limits. Research workflows record each
project's exit status: a green evidence-collection job is not proof that every
project scan succeeded. The compiled CLI research control additionally checks
repeatable Markdown and failure atomicity when a valid TypeScript edit coincides
with a C# compilation failure. No application, database or web server needs to
be launched to collect these static-analysis results.

## Release gates and next implementation order

First freeze this source-evidence contract with independently reviewed provider
witnesses and failure cases. Add project-context reporting and a policy for
multi-target/shared-source compilations before widening discovery. Then qualify
installation and every intended OS/architecture against real developer SDK layouts.

A first public release needs a reproducible signed/provenance-tracked package,
complete dependency/license notices and SBOM, private-feed/proxy/offline setup,
concurrent/interrupted install tests, worker protocol compatibility checks,
SDK/runtime doctor output and reliable cancellation. Inventory should distinguish
“package present” from “this project's dependencies ready” without executing
untrusted code during a casual list command.

Broader production coverage needs a reviewed workspace-warning policy (including
cached NuGet audit results), generator diagnostics and inputs, accurate watch
invalidation, large-solution resource tests, platform-workload fixtures,
symlink/case/path tests and representative projects across the stated matrix.
Measure provider precision, unresolved coverage, statement correctness and map
selection separately; do not use relationship count as a quality score.

Finally, add one reviewed concrete receiver/callback example for C#, then one
framework registration/dispatch example, then a cross-boundary protocol example.
Keep core's policy shared across languages. C# framework expertise should make
source facts stronger—not create a second, incompatible architecture engine.

## Primary references

[sdk]: https://learn.microsoft.com/en-us/dotnet/core/project-sdk/overview
[locator]: https://learn.microsoft.com/en-us/visualstudio/msbuild/find-and-use-msbuild-versions
[global-json]: https://learn.microsoft.com/en-us/dotnet/core/tools/global-json
[invocation]: https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.operations.iinvocationoperation
[method]: https://learn.microsoft.com/en-us/dotnet/api/microsoft.codeanalysis.imethodsymbol
[di]: https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview
[single-file]: https://learn.microsoft.com/en-us/dotnet/core/deploying/single-file/overview
[restore]: https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-restore
[security]: https://learn.microsoft.com/en-us/visualstudio/msbuild/msbuild-security-best-practices
[releases]: https://builds.dotnet.microsoft.com/dotnet/release-metadata/10.0/releases.json
