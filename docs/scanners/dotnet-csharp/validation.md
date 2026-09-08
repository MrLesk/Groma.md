# C# prototype validation

These are measured research results, not a claim of production readiness.
The [scanner guide](index.md) defines the supported input and setup commands;
the [research report](production-readiness.md) explains the remaining decisions.
Core relationship selection was not changed for these experiments.

## Revisions and evidence

| Checkpoint | Evidence |
| --- | --- |
| Groma baseline | `0e1252c92a90ef87b30d4fb5cfa56e768d436fea` |
| Initial scanner/package qualification | `fd56e71a17240a566afe9a0a33352a726f085f25`; [C# workflow 34168277706](https://github.com/MrLesk/Groma.md/actions/runs/34168277706), [repository CI 34168277734](https://github.com/MrLesk/Groma.md/actions/runs/34168277734) |
| ASP.NET research and compiled CLI control | `f69d3ce6cd0bb26d39c8bb3e6c6ba012fefac7c7`; [research run 34191996109](https://github.com/MrLesk/Groma.md/actions/runs/34191996109) |
| FluentValidation source | [12.0.0 at 5365d9294812c8a5c5a7f4d7447c9a65b79a025b](https://github.com/FluentValidation/FluentValidation/tree/5365d9294812c8a5c5a7f4d7447c9a65b79a025b) |
| eShopOnWeb source | [4da8212117e87d808d4bbc7da6286fd2147ce606](https://github.com/dotnet-architecture/eShopOnWeb/tree/4da8212117e87d808d4bbc7da6286fd2147ce606) |

The Linux artifact `csharp-prototype-ubuntu-22.04` from the initial C# run
contains the FluentValidation observation, ordered source manifest, timing,
resource report and private-SDK installation result. The ASP.NET research run's
`csharp-real-project-evidence` artifact contains each restore command, restore
and scan exit codes, complete logs, successful observations, manifests, CLI
invariants and an archive of the pinned application source. Actions artifacts
have limited retention; the pinned inputs and checked-in scripts are the
reproduction authority, not an assumption that artifacts remain downloadable.

No application, database or application web server was launched. These were
explicitly trusted disposable checkouts: restore and MSBuild design-time loading
can execute repository-controlled logic. Tracked application source remained
unchanged. Preparation/restore costs are separate from the scan timings below.
A green research workflow means evidence collection succeeded, **not that every
selected project was supported or scanned successfully**.

## Measured successful observations

Each benchmark starts a fresh worker three times and compares the complete
parsed observations, not just their counts. Roslyn was `5.9.0.0`, Bun `1.4.1`.
Both Linux research runners used Ubuntu 22.04. The worker runs on .NET 10;
the selected project SDK is reported separately.

| Measurement | FluentValidation library | eShopOnWeb PublicApi, audit-disabled research control |
| --- | ---: | ---: |
| Selected project SDK | 9.0.317, original `global.json` retained | 10.0.400 |
| Physical source files | 138 | 125 |
| Project scopes | 1 | 4 |
| Temporary source relationships | 405 | 244 |
| Implemented operations | 820 | 298 |
| Explicit invocation records | 1,352 | 1,700 |
| Resolved invocation records | 590 | 96 |
| Unresolved invocation records | 762 | 1,604 |
| Fresh-worker elapsed seconds | 6.273, 5.173, 5.058 | 7.479, 7.122, 7.105 |
| Complete observations equal | Yes, all three | Yes, all three |
| `/usr/bin/time -v` maximum RSS | 218,412 KiB | 270,008 KiB |

The resource report is the operating system's maximum-RSS measurement for the
benchmark command and its waited-for children. It is **not** a sampled simultaneous
sum of every process, a managed-heap measure, or a hard memory limit. These
are individual measurements of small/medium inputs, not large-solution
certification, statistical latency guarantees or painted-map startup times.
Unresolved records include external-library calls and unsupported dispatch;
these counts are neither precision scores nor a measure of architecture quality.

The source-manifest SHA-256 values are:

```text
FluentValidation: 4afa2e1c79a5ce2c66c1436b05dfd6cc2f7d016c83c8e833dd45f577fecf74d3
PublicApi:        53f2a7bb2fc9639bab0cbf17eb566861e87fd93dca2e9c47bfc845aab36815da
```

FluentValidation's linked `src/CommonAssemblyInfo.cs` remains one physical
inventory entry. PublicApi loads ApplicationCore, BlazorShared, Infrastructure
and PublicApi; BlazorShared is a class library, not a claim to support the
Blazor WebAssembly SDK. All source paths remain relative to the repository root
although the selected project is nested.

## ASP.NET default behavior and the control

Both eShopOnWeb inputs were tried first with ordinary explicit restore. Restore
returned exit 0, but cached `NU1903` warnings concerning `System.Text.Json` 8.0.3
surfaced as MSBuild workspace failures during scanning. The worker therefore
refused to publish a complete observation. Setting `NuGetAudit=false` during
workspace creation does not erase previously restored audit diagnostics.

A separately labeled experiment repeated restore with `--force -p:NuGetAudit=false`.
This isolates source-analysis capability from the cached diagnostic failure.
**It does not remediate the dependency advisory and is not a recommended
installation default.** The default restore logs and failures are retained.
No package version, project source or scanner failure policy was changed to
make the experiment pass.

| Input | Default restore policy | Audit-disabled research control |
| --- | --- | --- |
| `src/PublicApi/PublicApi.csproj` | Restore 0; scan 1, cached audit/workspace failure | Restore 0; scan 0; three identical observations and compiled CLI invariants pass |
| `src/Web/Web.csproj` | Restore 0; scan 1, cached audit/workspace failure | Restore 0; scan 1, unsupported SDK in `src/BlazorAdmin/BlazorAdmin.csproj` |

The full Web graph is **not supported**. Rejecting that transitive Blazor project
rather than silently omitting it preserves the complete-observation contract.
A production release needs an explicitly reviewed workspace-warning policy,
while genuine omitted projects, missing references and compilation failures
must continue to block reconciliation.

## Source witnesses, not just graph counts

The raw observations were checked against these pinned source locations.

| Source witness | Observed result |
| --- | --- |
| FluentValidation `AbstractValidator.cs:271`, construction of `ConditionBuilder<T>` followed by `When` | Both constructor and method resolve to implementations in `Internal/ConditionBuilder.cs`, without unresolved alternatives |
| FluentValidation `AbstractValidator.cs:349,359`, `OnRuleAdded(rule)`; virtual declaration at line 397 | The declared operation remains a candidate with `unresolved: true`; it is not claimed as the definite runtime override |
| PublicApi `CreateCatalogItemEndpoint.cs:43`, `new CatalogItemNameSpecification(...)` | Resolves to the source constructor |
| Same endpoint, line 50 `new CatalogItem(...)` and line 59 `UpdatePictureUri(...)` | Resolve to the ApplicationCore entity's source implementations |
| Same endpoint, lines 44, 51 and 60, injected repository `CountAsync`, `AddAsync`, `UpdateAsync` | Empty target sets with `unresolved: true` |
| Same endpoint, line 70 `IUriComposer.ComposePicUri`, line 74 external `Results.Created` | Unresolved, rather than invented source implementations |

Source: [FluentValidation AbstractValidator](https://github.com/FluentValidation/FluentValidation/blob/5365d9294812c8a5c5a7f4d7447c9a65b79a025b/src/FluentValidation/AbstractValidator.cs),
[eShopOnWeb endpoint](https://github.com/dotnet-architecture/eShopOnWeb/blob/4da8212117e87d808d4bbc7da6286fd2147ce606/src/PublicApi/CatalogItemEndpoints/CreateCatalogItemEndpoint.cs),
and [PublicApi registration](https://github.com/dotnet-architecture/eShopOnWeb/blob/4da8212117e87d808d4bbc7da6286fd2147ce606/src/PublicApi/Program.cs).

PublicApi registers `IRepository<>` and `IReadRepository<>` to `EfRepository<>` at
Program lines 40–41. The prototype does not equate that registration with a
proved receiver binding. It emits no fabricated callback binding to force
these ordinary calls through core's supplied-named-callback rule. Likewise,
method and project references do not prove HTTP or database communication.
The observations provide evidence and inventory, **not a complete automatically
derived C4 collaboration map**.

## Compiled installation and failure atomicity

At the initial checkpoint, package relocation and a compiled Groma CLI passed
on Linux, macOS and Windows. The Linux private-install control used a new cache
and explicit SDK installation: 6 files, 2 scopes, 19 operations, 24 invocations;
3.024 seconds for the first complete CLI scan. Repeated architecture Markdown
was identical and a deliberate compilation failure preserved the map.
The prebuilt package is framework-dependent, not a self-contained executable;
.NET runtime and project SDK readiness are distinct.

On PublicApi's labeled successful control, the actual compiled CLI took
7.207 seconds for its first complete scan. A second scan preserved all
architecture Markdown byte-for-byte. Then the harness added a valid TypeScript
source and a C# source referring to a nonexistent type. The resulting C#
compilation error prevented the entire reconciliation, including the pending
TypeScript edit; the existing Markdown hash remained unchanged:

```text
ebbc87ffdc72db1995ed1dac51e3e6dbfddad494e65e876c843c32b28e110fe9
```

The harness initializes Groma only in an explicitly disposable clone and uses
Groma commands for architecture creation. The first run left the newly created,
untracked `AGENTS.md` from `groma init`; the cleanup now preflights that file's
absence and removes only the file it owns. It does not remove an existing
instruction file or alter tracked application source.

## Test checkpoints and outstanding gates

The initial `fd56e71` checkpoint passed repository checks, the 17-test Roslyn
suite and package relocation on all three CI operating systems. That historical
success must not conceal later failures:

- The 8 September local Roslyn run passed all 17 tests. Its initial invocation
  inherited container variable `PLATFORM=linux/amd64`, which MSBuild interpreted
  as an invalid solution platform. The corrected run removed that unrelated
  environment variable; no test assertion or timeout changed.
- The local full `bun run check` passed lint/typechecking and all 110 Node tests,
  then reported 364 Bun passes and one TUI-source wait failure. The exact same
  unchanged test failed in isolation on the original main snapshot with the
  same runtime and dependencies. This establishes a local baseline failure,
  not a passing full check or a diagnosed fix.
- At `f69d3ce`, [repository CI 34191998667](https://github.com/MrLesk/Groma.md/actions/runs/34191998667)
  passed on Linux and macOS. Windows passed 110 Node tests and the C# adapter
  tests, but failed the existing empty-project live-watch test at
  `test-bun/web-startup.test.ts:196`: the new component never reached the map.
  This failure has not been proven to share the local TUI failure's cause.
- At the same revision, [C# CI 34191998649](https://github.com/MrLesk/Groma.md/actions/runs/34191998649)
  passed macOS repository checks but its Roslyn suite had 16 passes and one
  fixture-restore failure: NuGet reported an already-existing generated props
  file with `/var` and `/private/var` paths in the diagnostic. This is not a
  certified fix for symlinked roots, and the failed package step was not run.

No failing assertions were deleted, retries added, timeouts raised or test
scope reduced. These integration/qualification issues remain review gates.
The implementer's source and specification review is not an independent cold
simplicity or full-context review; those repository-required review gates are
also still pending. TASK-324 and PR #106 therefore remain in progress/draft.

## Reproduce

Prepare the worker and Groma from this branch using the commands in the
[scanner guide](index.md). The benchmark accepts an already-restored project;
it never builds or restores the application itself.

```sh
# From the Groma checkout, with a separate trusted FluentValidation checkout:
bun scripts/benchmark-csharp-scanner.ts /path/to/FluentValidation \
  src/FluentValidation/FluentValidation.csproj

# From the Groma checkout, with the separately restored pinned eShopOnWeb:
bun scripts/benchmark-csharp-scanner.ts /path/to/eShopOnWeb \
  src/PublicApi/PublicApi.csproj

# Only in a disposable clone, initially without Groma or AGENTS.md:
bun scripts/validate-csharp-repository.ts /path/to/eShopOnWeb \
  src/PublicApi/PublicApi.csproj dist/groma dist/csharp-scanner-package \
  /path/to/evidence
```

The exact clone, SDK setup, default restore and labeled control commands live
in [the real-project workflow](../../../.github/workflows/csharp-project-research.yml).
On Windows the compiled binary is `dist/groma.exe`. A missing project SDK,
unavailable package feed, unsupported project or exceeded limit is a failed
experiment, not a successful empty observation.
