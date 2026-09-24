---
id: TASK-499
title: Qualify and improve the C# scanner on public repositories
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 19:21'
updated_date: '2026-09-24 08:35'
labels: []
dependencies: []
references:
  - csharp-analysis
  - csharp-command
  - csharp-outline
  - csharp-http
  - csharp-src-index
modified_files:
  - plugins/scanners/csharp/dotnet/ProjectFile.cs
  - plugins/scanners/csharp/dotnet/ScanRequest.cs
  - plugins/scanners/csharp/dotnet/ProjectGraph.cs
  - plugins/scanners/csharp/dotnet/SourceProject.cs
  - plugins/scanners/csharp/dotnet/Scanner.cs
  - plugins/scanners/csharp/dotnet/PartialSourceUnits.cs
  - plugins/scanners/csharp/dotnet/SourceOutline.cs
  - plugins/scanners/csharp/dotnet/OperationEvidence.cs
  - plugins/scanners/csharp/dotnet/HttpEndpoints.cs
  - plugins/scanners/csharp/dotnet/HttpRequests.cs
  - plugins/scanners/csharp/dotnet/Command.cs
  - plugins/scanners/csharp/dotnet/ProjectInput.cs
  - plugins/scanners/csharp/src/adapter.ts
  - plugins/scanners/csharp/src/index.ts
  - plugins/scanners/csharp/src/config.ts
  - plugins/scanners/csharp/package.json
  - plugins/scanners/csharp/dotnet/test/ScannerFixture.cs
  - plugins/scanners/csharp/dotnet/test/ScannerTests.cs
  - plugins/scanners/csharp/dotnet/test/OperationTests.cs
  - plugins/scanners/csharp/dotnet/test/CoverageTests.cs
  - plugins/scanners/csharp/dotnet/test/HttpEvidenceTests.cs
  - plugins/scanners/csharp/dotnet/test/ProjectGraphTests.cs
  - plugins/scanners/csharp/dotnet/test/SourceUnitTests.cs
  - plugins/scanners/csharp/dotnet/test/OutlineTests.cs
  - test/fixtures/csharp-http/FactoryClient.cs
  - test-bun/csharp-http.test.ts
  - docs/scanners/dotnet-csharp/index.md
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/evidence.md
  - >-
    groma/systems/groma-md/containers/csharp-worker/components/csharp-analysis.md
  - groma/systems/groma-md/containers/csharp-worker/components/projectfile.md
  - groma/systems/groma-md/containers/csharp-worker/components/projectgraph.md
  - groma/systems/groma-md/containers/csharp-worker/components/csharp-command.md
  - groma/systems/groma-md/containers/cli/components/csharp-src-index.md
  - test/fixtures/csharp-operations/tests/App.Tests/CallsTests.cs
ordinal: 580000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The C# scanner has been qualified on FluentValidation and small fixtures only. Real repositories combine SDK variants, conditional and multi-target builds, platform and desktop targets, generated and Razor code, custom routing patterns and very large solutions that the fixtures do not exercise. Alex asked for a repository-by-repository pass over every remaining official scanner on 2026-09-23, starting with C#: scan diverse public C# projects, diagnose real edge cases, and fix verified scanner failures while keeping C4 interpretation in language-neutral Groma core.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ten distinct public C# repositories are scanned at recorded commits, with concrete evidence and each result classified.
- [x] #2 Verified defects in the supported C# scan flow are fixed with focused regression coverage where existing tests leave a gap.
- [x] #3 The complete repository check passes after the C# scanner changes.
- [x] #4 Temporary repository clones are removed after C# qualification and the results are reported to Alex before work starts on another scanner.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ten read-only agents each clone one pinned public repository into the session scratchpad and report source-backed defects with minimal repros; they never edit the shared checkout. Repositories: dotnet/eShop, davidfowl/TodoApp, jellyfin/jellyfin, bitwarden/server, Squidex/squidex, ShareX/ShareX, PowerShell/PowerShell, files-community/Files, jasontaylordev/CleanArchitecture, Unity-Technologies/game-programming-patterns-demo.
2. One project graph in the worker: the adapter sends the tracked, unignored and not excluded C# inventory and every input in one stdin request; the worker loads each SDK-style project once (any SDK; other languages skipped; legacy projects skipped with a warning), evaluates its nearest Directory.Build.props, the project file and literal imports (unconditional properties and items in document order; an unset property is empty in a property value and leaves an item or import path unknown), follows references transitively, compiles each project once, analyzes a file shared by several projects in the first project by path while keeping every project root, and reports diagnostics with file and line. Calls without a repository target are not emitted. Build output, test code and generated files are left out through the scanner's own exclude list in the adapter, like the Python and Swift lists (Alex, 2026-09-24): bin and obj in any letter case, test and tests folders in either initial case, folders ending in Tests, *.Test folders, and *.Designer.cs, *.g.cs, *.g.i.cs and *.generated.cs files. The worker reads only the inventory it receives and has no test or generated-file detection of its own.
3. Evidence: C# 14 extension blocks, nested types in partial units, the unit primary named after the class, deterministic lambda operations, OutputType case, AllowUnsafeBlocks, Using items. HTTP: the most derived class declaring [Route] supplies the controller prefix, also across projects; SendAsync with a local request message; clients from IHttpClientFactory.CreateClient. listSourceFiles stays in the adapter as the superset of inventory C# files, because CI runs bun run check without .NET and every scanner lists without its worker.
4. Not done, for Alex: routes mapped inside helper methods on a builder parameter (needs framework reference assemblies to bind the calls), Unity projects without tracked project files, blocker endpoints for computed MapGroup prefixes. Invocation-only gaps (single candidate, primary constructors, InternalsVisibleTo keys) change no map result.
5. Test decisions (rule; wrong result; gap; test): T1 C# page loads each project once: shared projects duplicated roots and operations and lint reported self-duplicates; no multi-input test; two solutions share a library. T2 SDK-style projects: Razor, versioned Aspire, explicit Sdk imports and a vcxproj entry failed the whole scan; tests covered three headers; one mixed solution scans with entries from top-level statements and OutputType EXE and a warning for the legacy project. T3 declared context: props ImplicitUsings, imported DefineConstants, Using items, AllowUnsafeBlocks and Compile order were ignored, and an SDK-only path must not remove every file; one props test. T4 transitive references and linked files: App->Mid->Core calls unresolved and a linked file aborted the scan; one transitive test and one linked-file test. T5 exclude list: test code produced components and every Jellyfin request, and nothing proved the list reaches the inventory; one test-folder file in the shared listing fixture (red without the filter). T6 diagnostics carry file and line (in T3). T7 extension blocks crashed and outlines lost members; one outline test. T8 nested types blocked units and part files named them; one unit test. T9 lambdas varied from run to run under failed binding; one lambda test. T10 HTTP: a base [Route] hid 418 of 419 Jellyfin and all 267 Squidex endpoints, including a base in another project; SendAsync with a local message and factory clients were missed; one cross-project test and fixture cases.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ten pinned public scans (baseline before fixes), each classified by a read-only agent with source evidence and minimal repros under the session scratchpad csharp/: dotnet/eShop b4a40872005d4bb29e5b1fa1ff7e244143d39215 (default scan fails on Razor, MSTest and Aspire SDK headers; linked shared file fails three services; transitive references missing; ClientApp loaded by three solutions; extension block crash reproduced separately); davidfowl/TodoApp 307a1eadbbd77a3004c318f2377e4818bc400af6 (BlazorWebAssembly and Aspire headers fail the scan; Directory.Build.props ImplicitUsings and Using items ignored, so 9 HttpClient requests are lost; routes in MapX(this IEndpointRouteBuilder) extensions missing); jellyfin/jellyfin 208c278b75abd897aefa1e1175126eac5e4dbfaa (SharedVersion.cs linked into 20 projects fails every useful input; base controller [Route] hides 418 of 419 endpoints; transitive references; lambda operations nondeterministic; tests supply every request); bitwarden/server 0403a48640348bedcb016c1cb86b8633fcf4581e (extension blocks crash 70 of 83 graphs; slnx sqlproj entry fails; 442 MiB output exceeds the adapter cap and combining overflows the stack; 686 controller endpoints exact on a patched copy; ImplicitUsings from props lifts requests from 76 to 768); Squidex/squidex 19f14e80590b86e9d2b35b3e11a8ded2553f3acc (scan ok; 5450 of 6502 lint findings are self-duplicates from overlapping solutions; base [Route] hides all 267 endpoints); ShareX/ShareX 4be24c97c015211b72c6a94e6034ff96529283b7 (scan ok; 1739 of 2302 lint findings self-duplicates; Using items and AllowUnsafeBlocks ignored; nested types block partial units; Designer files name components); PowerShell/PowerShell 0817ada8e7b95717fda4483054ee8ed0f1367ac8 (explicit Sdk imports fail the default scan; imported DefineConstants ignored; transitive references; OutputType EXE ignored); files-community/Files 4555f6580471735d855024ccb87c8296fc3b8f1f (vcxproj entries and extension blocks fail every scan of the app; analyzer-only project reference compiled); jasontaylordev/CleanArchitecture 1d71eefc5ccf9a5e9b2db86e4cf08070148c7bb4 (Aspire AppHost fails the default scan; all 10 minimal API endpoints hidden behind wrappers, group parameters and reflection); Unity-Technologies/game-programming-patterns-demo edbd64fd5635e567d99cf0cfd4f2f7f37ef9dc97 (no tracked projects: 212 C# files give no evidence and discovery reports nothing). Shared across repos: listSourceFiles omits referenced and linked files, and diagnostics embed their location in the message. Invocation-only gaps (single-candidate calls, primary constructors, InternalsVisibleTo keys) change no map result because C# invocations carry no bindings; recorded as follow-ups.

Implementation evidence: rescans with the new worker on the unmodified clones. TodoApp, CleanArchitecture, eShop, Jellyfin, Bitwarden, PowerShell and Files failed before and now scan with default settings; ShareX and Squidex scanned before and keep one root per file. Jellyfin reports 420 controller endpoints (was 1), identical to the agent hand-routed baseline; Squidex 267 (was 0), matching the agent independent evaluation; Bitwarden 677 non-test endpoints against 686 including tests on the patched baseline. Requests: TodoApp 9 (was 0), eShop 24, Bitwarden 22 non-test. Self-duplicates are gone (ShareX 13 project roots, Squidex 17, no file in two contexts unless several projects compile it). Bitwarden output fell from 442 MiB to 26 MB and 1,036,566 to 9,899 invocations; worker 55 s CPU, 1.5 GB peak. Listing equals the scanned files in all ten repositories. Correction to the earlier follow-up note: the single-candidate call rule is implemented; primary-constructor targets, InternalsVisibleTo public keys and the worker assemblies visible to scanned code remain follow-ups because no map result depends on them.

Verification: bun run check on a clean detached worktree at 0b7f0ad9 plus exactly the TASK-499 files passed (Biome 559 files, typecheck, Node 16 pass, Bun 709 pass, 43 skip, 0 fail). Roslyn suite (bun run test:csharp) 31 pass, including 9 new regression tests. Packaged Bun C# suites with GROMA_TEST_CSHARP_PACKAGE (HTTP rows including the new factory-client row, lint, outline, source units with live watch, process, packaging) pass, and the shared listing test passes its C# case. The listing moved back to the adapter as a superset (every tracked C# file outside bin and obj once a C# project exists) because CI runs bun run check without .NET, like every other scanner listing; TodoApp lists 40 files for 30 scanned and omits none.

Cold simplicity review (fresh agent, task and diff only): no blocking finding. Applied: reverted the invocation-only changes (error-span guard removal, single-candidate targets, shared-file unresolved flag) since C# invocations carry no bindings and change no map result, keeping the deterministic lambda rule; removed unreachable call handling and the import cap; an item or import path naming an unset property now stays unknown instead of expanding to an empty prefix (red-to-green verified: without the rule a Remove of $(BaseIntermediateOutputPath)** removed every file); removed a redundant bin/obj check; generated files leave the source map instead of a separate set; transitive references are built in the graph; the first listing solution is recorded per project; the analyzer-only reference rule was dropped (it only removed three duplicate-type warnings); unused adapter parameters and export removed; stale comments and a test name corrected. Roslyn suite 31 pass after the changes.

Full-context complexity review (separate agent; it received a written brief of the conversation because a context fork was unavailable): no blocking finding. Advisory items kept for Alex rather than applied: one owner for bin/obj filtering; drop the input exception in ProjectGraph.Visit; a read-only graph; rename SourceProject to ProjectCompilation and split csharp-analysis into C# projects and evidence; groma view on a test or generated file says waiting for a scan; optionally move the project evaluation into the TypeScript adapter so the listing is exact and runs in bun run check, since CI runs neither test:csharp nor the packaged suites.

Scanner/core separation (rule relayed on 2026-09-24): scanner text no longer names C4 concepts or core in this task's changes. Reworded the CSHARP_TEST_PROJECT note (its source is not scanned), the partial-unit primary comment, the invocation and operation summaries, and removed the architecture-relationship sentence from CSHARP_OPERATION_SCOPE. Committed comments that still name core as the consumer, outside this task's files: HttpEvidence.cs:7 and :18, HttpRoutes.cs:172 and :240, OperationTokens.cs:8. No core file changed in this task.

Clones: all ten repository clones (2.9 GB) were deleted from the session scratchpad after the rescans; none remain.

Re-verification after these edits: Roslyn suite 31 pass; packaged C# suites 8 pass together in 6.5 s (an earlier run hit the source-units watch test's 20 s limit while other sessions loaded the machine; it passes alone in 4.1 s).

Final verification: bun run check on a clean detached worktree at bc7c30e5 plus exactly the TASK-499 files (shared scanner docs carrying only the C# rows) passed: Biome 563 files, typecheck, Node 16 pass, Bun 723 pass, 45 skip, 0 fail.

Correction (Alex, 2026-09-24): scanners already own an exclude list, so test and generated code are ignored the same way. The worker's test-project detection (packages, IsTestProject, MSTest SDK, CSHARP_TEST_PROJECT) and its <auto-generated> context-only rule are removed, and so is its own bin/obj filter. The adapter's exclude list now covers bin and obj, test folders and generated file names; it feeds watch.exclude, the scan inventory and the listing, so excluded files are never read, like scanners.json exclusions. A declaration only an excluded file provides, such as a WinForms designer's InitializeComponent, is now a missing-name warning where it is used. Test changes: the worker graph test for test and generated files is deleted; the worker fixture no longer copies ignored local bin and obj output, and the vacuous bin/obj assertion in the determinism test is removed; the shared listing fixture gains tests/App.Tests/CallsTests.cs, and the C# listing case fails without the adapter filter and passes with it. Roslyn suite 30 pass; C#, listing, exclusion and fresh-checkout Bun suites pass with the repackaged worker.

Final verification after the exclude-list correction: bun run check on a clean detached worktree at bc7c30e5 plus exactly the TASK-499 files (shared scanner docs carrying only the C# rows) passed: Biome 563 files, typecheck, Node 16 pass, Bun 723 pass, 45 skip, 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Qualified the C# scanner on ten pinned public repositories (eShop, TodoApp, Jellyfin, Bitwarden, Squidex, ShareX, PowerShell, Files, CleanArchitecture, a Unity demo) and fixed the verified defects. The adapter now sends the repository's C# inventory and every input in one request; the worker builds one project graph that loads each SDK-style project once (any SDK), evaluates Directory.Build.props, imports and project items, follows references transitively, analyzes shared files once while keeping every project root, supports C# 14 extension blocks, and names partial units after their class. HTTP evidence reads a base controller's [Route] (also across projects), SendAsync with a local request message and IHttpClientFactory clients. Build output, test code and generated files are left out through the scanner's own exclude list, like the Python and Swift lists. Results: seven repositories that failed now scan with default settings; Jellyfin endpoints 1 to 420, Squidex 0 to 267, TodoApp requests 0 to 9, Bitwarden output 442 MiB to 26 MB; self-duplicates gone. Verified with bun run check on a clean copy of main plus the task files (Bun 723 pass, 0 fail), the Roslyn suite (30 pass), the packaged C# suites and a red-to-green listing check for the exclude list. Deferred for Alex: route helpers that need ASP.NET reference assemblies, Unity projects without project files, blocker endpoints for computed group prefixes, and the reviewer's advisory refactors.
<!-- SECTION:FINAL_SUMMARY:END -->
