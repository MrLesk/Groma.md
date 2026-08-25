---
id: TASK-174
title: Test the shared scanner contract against MassTransit
status: Done
assignee:
  - '@codex'
created_date: '2026-08-25 21:07'
updated_date: '2026-08-25 21:40'
labels: []
dependencies: []
modified_files:
  - experiments/dotnet-scanner/src/Groma.DotNetScanner.csproj
  - experiments/dotnet-scanner/src/Contract.cs
  - experiments/dotnet-scanner/src/Scanner.cs
  - experiments/dotnet-scanner/src/Command.cs
  - experiments/dotnet-scanner/src/Program.cs
  - experiments/dotnet-scanner/src/packages.lock.json
  - experiments/dotnet-scanner/test/Groma.DotNetScanner.Tests.csproj
  - experiments/dotnet-scanner/test/ContractTests.cs
  - experiments/dotnet-scanner/test/ScannerTests.cs
  - experiments/dotnet-scanner/test/packages.lock.json
  - experiments/dotnet-scanner/README.md
  - experiments/dotnet-scanner/scan-masstransit.sh
  - experiments/dotnet-scanner/.gitignore
priority: high
type: spike
ordinal: 186000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer runs a playground .NET scanner against MassTransit, it emits a deterministic, complete, language-neutral source-evidence snapshot without changing the target repository or deciding architecture ownership. The trial should show whether Roslyn can supply the same file, symbol, placement, relationship, and diagnostic boundaries proposed for TypeScript before Groma adopts a production multi-language scanner contract.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One reproducible command scans the MassTransit solution or projects and emits the shared scanner snapshot contract
- [x] #2 The snapshot reports source files and symbols separately from project placement, relationships, and diagnostics, without inferring multi-file component ownership
- [x] #3 The trial either emits one complete snapshot or fails without publishing partial architecture evidence, and it does not modify MassTransit or Groma architecture Markdown
- [x] #4 Focused tests and repeated runs verify contract validation, deterministic semantic output, and representative MassTransit evidence
- [x] #5 Fresh GPT-5.6 Sol and Grok reviews assess the implementation and output; justified fixes are applied and the final result is reported
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
1. Install a task-local .NET 10 SDK outside both repositories and record the clean MassTransit source state.
2. Build an isolated Roslyn 5.9 playground under experiments/dotnet-scanner with a language-neutral complete-snapshot contract, canonical JSON output, and no Markdown writer.
3. Export committed MassTransit source to a disposable directory, restore and load MassTransit.sln there, then emit project scopes, file/type-symbol evidence, separate placements, project-reference relationships, and normalized diagnostics. Abort before stdout when workspace work or validation makes the snapshot incomplete.
4. Test canonical ordering, contract rejection, partial declarations without ownership grouping, project references, deterministic fixture output, and failure before publication.
5. Run the disposable MassTransit command twice, compare byte output, verify representative evidence, and confirm the target Git state remains unchanged.
6. Obtain fresh GPT-5.6 Sol and Grok reviews, apply only task-authorized corrections, and target-check the reported blockers.
7. Run the required final complexity review, retain the minimum useful playground and conclusion, then finalize, commit, and push only TASK-174 files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Input: /Users/alex/projects/MassTransit at clean develop commit 62ab339afa3bac2e9b3fe1769d0d35d7e44778e9. The solution resolves to 56 project scopes; the repository contains 59 C# project files and 5,502 C# files.

Toolchain correction: MassTransit now includes net10.0 targets, so the trial uses a task-local .NET SDK 10.0.400 and current stable Roslyn 5.9.0 rather than the initially planned .NET 9 / Roslyn 4.11 pair.

Implementation: the scanner emits scopes, atomic file/type-symbol evidence, separate file placements, project-reference relationships, and normalized workspace diagnostics. It performs no ownership grouping and has no Markdown writer. The MassTransit wrapper scans a disposable git archive so restore does not write target build assets.

Final verification: 5 focused tests pass. Two disposable MassTransit runs emitted byte-identical 3,570,235-byte snapshots with SHA-256 ef61bdcfb1256775ec03906b5bae7d2999a30aee397b8cce01dc77e4be386c31: 56 scopes, 5,427 files, 5,427 placements, 209 relationships, 3 warnings, and 22 separate files for MassTransitStateMachine<TInstance>. Target tracked-file digest remained 7bf1db0a173e2e93cb4e107c0c505190d2275fabfa27ab7098476ce1e07506d1 and Git status remained empty. Shell syntax, JSON lock files, source line limits, and package vulnerability audit pass.

Requested reviews: Grok 4.6 reported no blockers and independently noted the possible late-workspace-diagnostic hole. GPT-5.6 Sol initially blocked on that hole, target restore mutation, and an overbroad stdout atomicity claim. Corrections moved the completeness check after all workspace work, added the disposable target wrapper, and narrowed stdout wording to pre-publication scanner/validation failures. Sol targeted re-review confirmed all three blockers resolved with no regressions.

Simplicity reviews: the cold review found no blocker and led to removal of the duplicate scope path, a duplicate canonicalization selector, one redundant assertion, the Roslyn version fallback, and unused diagnostic scope; a local ignore prevents generated bin/obj files from being staged. The final full-context complexity review recommends the current domain grouping and atomic evidence boundary as the simplest junior-safe approach, with no further in-scope change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented an isolated .NET 10 / Roslyn 5.9 feasibility scanner with a canonical language-neutral evidence snapshot, separate project placement and relationships, atomic file evidence for partial types, final completeness validation, and no architecture ownership or Markdown writer. Added a one-command disposable MassTransit trial so restore and scanning do not write target build state. Verified 5 focused tests, package and file hygiene checks, and two byte-identical real scans: 56 scopes, 5,427 files and placements, 209 relationships, 3 diagnostics, 3,570,235 bytes, SHA-256 ef61bdcfb1256775ec03906b5bae7d2999a30aee397b8cce01dc77e4be386c31. MassTransit stayed Git-clean with the same tracked-file digest. Fresh GPT-5.6 Sol and Grok reviews completed; Sol targeted re-review confirmed all fixes. Cold and full-context complexity reviews found no remaining blocker or justified simplification.
<!-- SECTION:FINAL_SUMMARY:END -->
