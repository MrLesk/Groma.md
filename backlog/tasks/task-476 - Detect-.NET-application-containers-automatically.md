---
id: TASK-476
title: Detect application containers automatically
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 16:42'
updated_date: '2026-09-21 20:17'
labels: []
dependencies: []
references:
  - >-
    https://github.com/dotnet-architecture/eShopOnDapr/tree/ad9a07b4d2b4aa564c53bcefcca25744642dc243
  - src-scanner
  - scanner-src-index
  - csharp-analysis
  - csharp-command
  - curate
  - scanners-projects
  - go-analysis
  - rust-src-index
  - rust-analysis
  - runtime
  - typescript-src-index
  - javascript-src-index
  - react-src-index
  - angular-src-index
  - vue-src-index
  - scanner-registry
  - swift-src-index
  - php-src-index
  - java-src-index
  - instructions
documentation:
  - docs/component-markdown.md
  - docs/scanners/index.md
modified_files:
  - packages/scanner/src/index.ts
  - plugins/scanners/observations.ts
  - src/scanner/registry.ts
  - test-bun/scan-entrypoints.test.ts
  - src/scan-entrypoints.ts
  - src/curate-rename.ts
  - src/curate.ts
  - src/scan-reconciler.ts
  - plugins/scanners/csharp/dotnet/Contract.cs
  - plugins/scanners/csharp/dotnet/SourceProject.cs
  - plugins/scanners/csharp/dotnet/Scanner.cs
  - plugins/scanners/csharp/dotnet/test/ScannerTests.cs
  - plugins/scanners/go/worker/contract.go
  - plugins/scanners/go/worker/main.go
  - plugins/scanners/rust/src/project.ts
  - plugins/scanners/rust/native/src/scan.rs
  - plugins/scanners/python/worker/entries.py
  - plugins/scanners/python/worker/modules.ts
  - plugins/scanners/python/worker/scan.py
  - plugins/scanners/entry-points/javascript.ts
  - plugins/scanners/typescript/src/scan.ts
  - plugins/scanners/javascript/src/index.ts
  - plugins/scanners/react/src/scan.ts
  - plugins/scanners/vue/src/index.ts
  - plugins/scanners/angular/src/scan.ts
  - test-bun/execution-evidence.test.ts
  - plugins/scanners/entry-points/source.ts
  - plugins/scanners/typescript/src/source-analysis.ts
  - plugins/scanners/typescript/src/graph.ts
  - plugins/scanners/javascript/src/http.ts
  - plugins/scanners/javascript/src/entries.ts
  - plugins/scanners/java/java/md/groma/scanner/Declarations.java
  - plugins/scanners/java/java/md/groma/scanner/Main.java
  - plugins/scanners/swift/worker/Contract.swift
  - plugins/scanners/swift/worker/Evidence.swift
  - plugins/scanners/swift/src/index.ts
  - plugins/scanners/php/src/entries.ts
  - plugins/scanners/php/src/index.ts
  - plugins/scanners/typescript/src/index.ts
  - plugins/scanners/react/src/index.ts
  - plugins/scanners/angular/src/index.ts
  - test-bun/execution-evidence-native.test.ts
  - MANIFESTO.md
  - docs/scanners/index.md
  - docs/scanners/creating-a-plugin.md
  - docs/component-markdown.md
  - docs/product-model.md
  - docs/scanners/dotnet-csharp/index.md
  - docs/scanners/evidence.md
  - src/instructions.ts
  - test-bun/scanner-source-listing.test.ts
  - groma/systems/groma-md/containers/cli/components/src-scanner.md
  - groma/systems/groma-md/containers/cli/components/scanners-projects.md
  - groma/systems/groma-md/containers/cli/components/javascript-src-index.md
  - groma/systems/groma-md/containers/cli/components/php-src-index.md
priority: high
type: feature
ordinal: 552000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer scans a repository containing separate runnable applications, Groma represents those applications automatically as containers. All official scanner plugins supply source and configuration evidence through one neutral contract. Core combines those facts and applies one interpretation policy, then writes the existing architecture records consumed by every viewer.

The public eShopOnDapr backend example contains five executable API projects and two shared library projects. It must show five application containers while leaving the shared libraries unassigned. A repeat scan may complete missing container placement while preserving authored meaning, curated source ownership, component IDs and existing container assignments. Source roots, directories, imports and dependency use alone never establish a container.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Scanning a reviewed multi-application example automatically creates the corresponding containers and places their components so the existing web map shows separate application boundaries without manual container creation.
- [x] #2 Scanners report source evidence only, without C4 kinds, container choices, architecture IDs, or ownership decisions. Core applies the same interpretation policy to equivalent evidence from any scanner.
- [x] #3 Solutions, packages, project roots, directories, and imports alone do not establish container boundaries.
- [x] #4 Repeated scans preserve authored meaning, curated source ownership, and existing container identities without duplicate containers. First-scan and rescan placement behavior must follow the reviewed example.
- [x] #5 The result uses the existing C4 container and Markdown model and the shared viewer projection.
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
1. User approved implementation, including the proposed unknown-to-known rescan placement. Preserve authored container assignments, component identities, source ownership and Markdown meaning.
2. Add language-neutral execution-entry evidence: exact source entry, declaring source/configuration, declared name and the entry's own source-unit files. Multiple declarations of the same physical entry combine; multiple entries in a manifest remain distinct. Scanners never emit C4 roles. Core owns inference after all observations are combined.
3. Produce those facts in official scanners from compiler entry points and declared launch/build targets. Share JavaScript build/entry extraction across TypeScript, JavaScript and framework scanners, including full local source membership rather than entry-only placement. Keep referenced compilation units/libraries separate. Verify the public .NET backend and non-.NET multi-entry/browser examples.
4. Add one core entry-placement operation beside scan reconciliation. Infer containers from positive entry evidence, leave shared/conflicting membership at system level, reuse existing owners and preserve established assignments. Complete unidentified placement using the existing document rewrite/link machinery, including outgoing relative links, incoming references and flows.
5. Tests: existing root tests prove roots alone cannot create containers, but lack execution facts. Add focused regression coverage for automatic containers, same-name distinct entries, overlapping scanners in both orders, shared membership, and rescans preserving curated meaning and links. Existing producer tests lack execution extraction; extend them or use focused source fixtures to prove each supported declaration and referenced-library exclusion. Existing exclusion/relocation tests lack the new evidence; extend those boundaries to prevent stale entries or lost facts.
6. Update scanner/Markdown/manifesto contracts, verify public source-to-map behavior, run focused checks then bun run check. Run the required cold simplicity review, implementer specification/quality review, and full-context complexity review. Finalize only with evidence; commit and push task files only.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Current shared main had only unrelated .github/workflows/release.yml changes; no other active task had recorded file overlap. The user confirmed automatic representation after the read-only diagnosis. Scope is supported C# application detection, not database inference or new language producers. The previous public reproduction used locally installed worker 0.1.3; implementation verification will rebuild the worker from this task's source.

Alex clarified that the solution must work equally for all scanners. Production changes have not started; the shared positive-placement tests fail as expected. Reassessing the common evidence contract and official scanner coverage before implementation.

Correction: Alex reaffirmed that scanners only report evidence and core alone infers C4 elements. The phrasing and proposed per-scanner application detection were premature. Removed all draft test changes; no production implementation exists. Rereading all Groma documentation before revising the evidence contract and core inference design. The earlier implementation plan is superseded and must not be executed.

Documentation review completed across the 180 repository Markdown documents outside Backlog records, fixtures and generated/dependency files, plus ../chief-of-staff.md. The explicit boundaries are in MANIFESTO.md, docs/scanners/evidence.md, docs/scanners/creating-a-plugin.md, docs/scanners/index.md, and docs/component-markdown.md. groma/ confirms Scan results owns reconciliation, Architecture model owns C4 validation, and viewers consume the resulting world.

The earlier .NET-only scope statement and automatic reparenting acceptance criterion were assumptions, not user decisions, and are superseded by the current description and criteria. No new evidence field or inference rule is approved. The draft tests were fully rolled back; no source or test changes remain. Existing diagnostic test results establish current behavior only, not completion of this feature. Implementation remains stopped while the source-to-map design is clarified.

Consulted Claude through claude -p --model claude-fable-5-1 --effort max, then completed one targeted follow-up. Both calls succeeded. The revised proposal is saved outside the repository at /tmp/groma-container-design.zplc5wbj/revised-proposal.md. This is external design advice, not an approved contract or implementation.

Recommended direction: scanners supply positive build, launch and source-membership facts; Scan results combines them and owns the common C4 inference policy. Names are labels, never identity. Evidence needs precise source anchors and must distinguish multiple declared targets in one file. Repeated evidence is not another application or another vote. Missing evidence is unknown. Dependency use must remain separate from source ownership. Existing container assignments remain authoritative. Reuse the existing C4 Markdown records and shared projection; no viewer-specific grouping or new stored concept is proposed.

The first Claude proposal incorrectly included referenced libraries in program ownership. Its revision fixes that, but is still insufficient: declaration-file-only identity cannot represent multiple targets in one manifest; separate declarations can describe the same program; and entry-file-only membership leaves browser/import-based applications largely unresolved. Do not implement either proposed ScanProgram type as written, skip multi-target files, or describe .NET-only success as meeting the all-scanner requirement. The source-to-map design must account for the inspected Groma CLI/browser build declarations as well as the public .NET example before its factual contract is chosen.

Expected public backend example remains five API containers, with EventBus and Healthchecks not promoted to containers or assigned by dependency use alone. The reproduction covers seven backend projects, not the full solution or private repository. This expected result is a proposal awaiting review, not new verification evidence.

Asked Alex whether a rescan may complete an existing system-parented component's missing container placement while preserving IDs, source owners, authored text, links and every existing container assignment. The answer is pending. This is an explicit change to MANIFESTO.md's code-only rescan rule. Canonical ownership paths and movable.ts mean it requires a link-preserving relocation design, not just changing groma.parent or two documentation sentences. No wipe or broader move/refactor is approved.

No source or test changes were made during this consultation. The earlier draft tests remain reverted. Implementation and acceptance checks have not started.

Alex requested implementation after the design recommendation. This authorizes the proposed automatic unidentified-to-container transition; the earlier pending-design note is superseded. TASK-477 modified files do not overlap the implementation paths, so no coordination message is needed.

Coverage addition: every changed producer needs a minimal declared execution example to catch missing or invented facts. Existing scanner tests cover calls and roots but do not prove execution-entry facts. New producer assertions will check the entry, a known local member where supported, and an independent library remaining outside. Shared inference coverage also checks multiple entries in one compilation unit: each physical entry identifies itself; common helper ownership remains unknown.

Identity review: the physical execution entry identifies an existing container. A helper curated under another application must not identify this entry as that application. Extended core regression covers a shared compilation unit, distinct entry files and an already assigned helper; existing source owners and container assignments must win.

Cold simplicity review reproduced three AC4 defects: framework facts without an inventoried entry could reuse helper ownership; project overview links were omitted from relocation; encoded outgoing paths lost their encoding. Accepted fixes tighten the contract and reuse the existing link writer. Extend the existing rescan regression with a project overview link and an encoded guide link; the current test only covered component/flow links. React source listing must include .ts launchers so exclusions and source watching do not skip valid entry evidence; update existing listing expectations to its compiler input scope.

Public verification: eShopOnDapr pinned ad9a07b4d2b4aa564c53bcefcca25744642dc243 backend subset (Basket, Catalog, Identity, Ordering, Payment plus EventBus and Healthchecks) rescanned 148 files / 145 components from zero to five API containers. Ten library components remain system-parented. Exported the existing web viewer to /tmp/groma-task476-web and visually confirmed five separate boundaries. No private project access was used. Full .NET suite: 22 passed. Focused native execution checks: Go, Rust, Java, Python, Swift all passed.

Targeted cold re-review found the same entry-identity defect before entry inference: file reconciliation gave a newly discovered launcher its helper’s existing container. Extend the existing shared-compilation regression with an initial inventory containing only the already assigned helper. The wrong result is one container instead of distinct applications; earlier coverage inventoried all launchers before assigning the helper. Keep new entry members at system level until core interprets their execution evidence, while retaining every existing source owner and container assignment.

The targeted review reproduction now fails before the initial-placement fix (one container) and passes afterwards (three distinct entries, shared helper assignment retained). Both known and newly inventoried launcher cases pass. All ten shared entry/root tests pass. This completes the accepted cold-review findings without another broad review.

Implementer quality review is checking AC4 authored-content preservation in the expanded link writer. The existing rescan test has real links but no literal Markdown example. Extend it with one inline-code example and one fenced-code example: automatic placement must rebase actual links without rewriting example text. This tests the changed automatic relocation path, not a new Markdown feature.

Implementer specification review: the public backend produces five containers through the existing web projection; every official scanner supplies the same neutral entry facts; roots alone remain insufficient; rescan tests retain IDs, Code owners, relationships, flows and curated container identity. Quality review traced registry validation/exclusions → combined evidence → file reconciliation → entry placement → existing curation writer → standard model/viewers. Reproduced and fixed literal inline/fenced Markdown examples being rewritten during automatic movement. Seventeen placement/rename/system-curation checks now pass; the full repository check is running again. Existing domain modules own the behavior, with no new stored concept, viewer rule, dependency or compatibility layer.

Final repository validation passed: bun run check, including 16 Node tests and 648 passing / 38 skipped Bun tests (686 total in 129 files), with zero failures. The C# suite passed all 22 tests; explicit native execution evidence checks passed for Go, Rust, Java, Python and Swift. git diff --check passed and every changed source/test file remains below 500 lines. The public backend repeat scan creates zero records and retains five application containers. Full-context complexity review is in progress; no code changes are pending.

Full-context complexity review passed with no blocking findings or material architecture changes. The reviewer recommends keeping the single evidence contract, shared core rule and existing curation/viewer flow. Accepted its one naming improvement: entryMemberFiles states that the set contains all execution-unit members, not only launchers. Targeted self-review confirms this is a local rename with no behavior change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Automatic application containers now use one shared core interpretation of neutral execution-entry evidence from all twelve official scanners. Source roots and imports alone do not create boundaries. Repeat scans complete missing placement while preserving source owners, IDs, authored Markdown, links, relationships, flows and established container assignments. The existing C4 records and viewer projection render the result.

Verified the pinned public eShopOnDapr backend: five API containers, 145 existing components preserved, shared library components unassigned, and no new records on a repeat scan. Visually checked the existing web export. bun run check passed (16 Node tests; 648 Bun passed, 38 skipped, zero failures); all 22 C# tests and explicit Go/Rust/Java/Python/Swift evidence checks passed. Cold simplicity, implementer specification/quality, and full-context complexity reviews completed. The final reviewer recommended keeping the architecture; its naming improvement was applied and checked.
<!-- SECTION:FINAL_SUMMARY:END -->
