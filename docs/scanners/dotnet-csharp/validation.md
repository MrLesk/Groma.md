# C# scanner qualification

Local qualification on 8 September 2026 used macOS arm64, Bun 1.4.1, .NET SDKs 10.0.400 and 9.0.317, Roslyn 5.9.0.0, and a compiled Groma 0.2.0 binary. The consumer binary SHA-256 was `bebd248e71d173b6a3eb780bcd9c946e37071a1148b57c899a4107374a51d5c0`. It was built from the shared working checkout based on `0e1252c92a90ef87b30d4fb5cfa56e768d436fea`, including the uncommitted C# delivery, technology-discovery, and evidence-composition changes for TASK-326. It is a working-tree snapshot, not an immutable Git revision. Linux and Windows consumer qualification belongs to the common release task; this record does not claim those runs passed.

## Reused research

The implementation reuses `origin/research/csharp-scanner-prototype`: the Roslyn/MSBuild worker, canonical operation extraction, project/context validation, independent C# fixtures, process adapter, and package/consumer validation scripts. The worker is prebuilt and framework-dependent. The private SDK installer and research setup API are not included. Restore keeps the project's ordinary NuGet policy; the worker no longer sets `NuGetAudit=false`.

The selected real project is [FluentValidation 12.0.0](https://github.com/FluentValidation/FluentValidation/tree/5365d9294812c8a5c5a7f4d7447c9a65b79a025b), commit `5365d9294812c8a5c5a7f4d7447c9a65b79a025b`. Its original `global.json` selects SDK 9.0.317 even when SDK 10.0.400 is also installed. The selected input is `src/FluentValidation/FluentValidation.csproj`. Normal explicit restore succeeds with no dependency or source changes.

## Evidence and consumer checks

Two fresh workers produced byte-identical complete observations: 138 source files, one project scope, 820 implemented operations, and 1,352 explicit invocation records. These are evidence counts, not a measure of architecture quality.

The source witnesses match the research baseline:

- `AbstractValidator.cs:271` resolves construction and `When` to `Internal/ConditionBuilder.cs` without unresolved alternatives.
- `AbstractValidator.cs:349,359` retains `OnRuleAdded` as a known virtual declaration candidate with `unresolved: true`.

The package was relocated into a path containing spaces and loaded by compiled Groma. The independent project-reference fixture produced six files, two scopes, 19 operations, and 24 invocations. Repeated scans preserved the map byte-for-byte. Combining the two partial-operation files through Groma kept their common curated owner after a valid source edit. A deliberate compilation failure preserved the complete previous map.

Compiled Groma also scanned the pinned FluentValidation project. The first scan took 2.477 seconds on this machine. The second scan preserved all architecture Markdown. Adding a valid TypeScript probe and a broken C# probe made the combined scan fail before reconciliation; the map remained byte-identical. The probes were removed and tracked application source stayed unchanged. Map interpretation and review are recorded in TASK-326.2.

## macOS restore regression

The research failure reproduced on SDK 10.0.400: absolute solution paths below `/var/folders` reached NuGet together with their `/private/var/folders` aliases, and restore reported an already-existing `project.assets.json`. Passing the solution path relative to the fixture's working directory resolves this supported case. Both fixture restore helpers now use relative input; no retry, audit override, timeout increase, or assertion removal was used.

The original default Roslyn test command passes all 17 tests, including that solution case. Eight concurrent Bun tests cover input selection, configuration, scan-trigger files, tooling readiness, failed worker output, and bounded process failure. Focused lint and TypeScript checks pass. The repository-wide check and separate reviews are recorded in the Backlog task.

## Reproduce

Install .NET 10 for the worker and the selected project's SDK. Follow the [package preparation steps](index.md). Restore the pinned project from its own directory using a relative input. In a disposable checkout without existing Groma state:

```sh
bun scripts/validate-csharp-package.ts /path/to/groma /path/to/csharp-scanner-package
bun scripts/validate-csharp-repository.ts /path/to/disposable/FluentValidation \
  src/FluentValidation/FluentValidation.csproj /path/to/groma \
  /path/to/csharp-scanner-package /path/to/evidence
```

The repository validation retains the Groma map, scanner selection, and generated agent instructions for review. It removes only its two source probes. The script refuses to overwrite existing state. It does not restore the target project or run the application.
