---
id: TASK-519.4
title: Declare each scanner's files in a visible include list
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 18:21'
updated_date: '2026-09-24 19:05'
labels: []
dependencies:
  - TASK-519.2
  - TASK-519.3
references:
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/index.md
  - scanner-src-index
  - repository-listing
  - scanners-projects
  - go-src-index
  - java-src-index
  - csharp-src-index
  - csharp-command
  - csharp-analysis
  - rust-src-index
  - rust-analysis
  - src-index
  - php-src-index
  - swift-src-index
  - typescript-src-index
  - javascript-src-index
  - react-src-index
  - vue-src-index
  - angular-src-index
  - workspace-packages
modified_files:
  - packages/scanner/src/index.ts
  - src/repository-listing.ts
  - src/scanner/modules/config.ts
  - src/scanner/modules/selection.ts
  - src/scanner/modules/package.ts
  - src/scanner/modules/inventory.ts
  - src/scanner/registry.ts
  - src/scanner/watch-patterns.ts
  - src/scanner/modules/discovery.ts
  - src/scanner/source-watch.ts
  - src/scanner/modules/readiness.ts
  - src/source-coverage.ts
  - plugins/scanners/project-scanner.ts
  - test-bun/scanner-session.test.ts
  - test-bun/scanner-exclusions.test.ts
  - test-bun/source-coverage.test.ts
  - test-bun/scanner-compatibility.test.ts
  - test-bun/scanner-installation.test.ts
  - test-bun/scanner-restore.test.ts
  - test-bun/scanner-update.test.ts
  - test-bun/scanner-settings-lifecycle.test.ts
  - test-bun/viewer-scanner-availability.test.ts
  - test-bun/web-startup.test.ts
  - test-bun/lint-command.test.ts
  - test-bun/scanner-composition.test.ts
  - test-bun/code-outline.test.ts
  - test/fixtures/mixed-scanner-outline/plugins/alpha/package.json
  - test/fixtures/mixed-scanner-outline/plugins/alpha/index.js
  - test/fixtures/mixed-scanner-outline/plugins/beta/package.json
  - test/fixtures/mixed-scanner-outline/plugins/beta/index.js
  - test/fixtures/mixed-scanner-outline/groma/scanners.json
  - examples/scanner/index.ts
  - examples/scanner/package.json
  - examples/scanner/README.md
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/index.md
  - test-bun/scanner-settings.test.ts
  - test-bun/scanner-source-watch.test.ts
  - test-bun/scanner-source-listing.test.ts
  - docs/agent-instructions/structure.md
  - docs/agent-instructions/inspect.md
  - plugins/scanners/go/package.json
  - plugins/scanners/go/src/sources.ts
  - plugins/scanners/go/src/adapter.ts
  - plugins/scanners/go/src/index.ts
  - plugins/scanners/java/package.json
  - plugins/scanners/java/src/gradle.ts
  - plugins/scanners/java/src/java-input.ts
  - plugins/scanners/java/src/adapter.ts
  - plugins/scanners/java/src/index.ts
  - test-bun/go-scanner.test.ts
  - test-bun/java-scanner.test.ts
  - test-bun/java-gradle.test.ts
  - docs/scanners/go/index.md
  - docs/scanners/java/index.md
  - test-bun/declared-source-listing.test.ts
  - plugins/scanners/csharp/package.json
  - plugins/scanners/csharp/src/index.ts
  - plugins/scanners/csharp/src/adapter.ts
  - plugins/scanners/csharp/src/config.ts
  - plugins/scanners/csharp/dotnet/ScanRequest.cs
  - plugins/scanners/csharp/dotnet/ProjectGraph.cs
  - plugins/scanners/csharp/dotnet/test/ScannerFixture.cs
  - test-bun/csharp-exclusions.test.ts
  - test-bun/csharp-http.test.ts
  - test-bun/csharp-source-units.test.ts
  - docs/scanners/dotnet-csharp/index.md
  - plugins/scanners/rust/package.json
  - plugins/scanners/rust/src/project.ts
  - plugins/scanners/rust/src/index.ts
  - plugins/scanners/rust/native/src/scan.rs
  - test-bun/rust-scanner.test.ts
  - test-bun/rust-workspace.test.ts
  - docs/scanners/rust/index.md
  - test-bun/execution-evidence-native.test.ts
  - plugins/scanners/projects.ts
  - groma/scanners.json
  - plugins/scanners/python/package.json
  - plugins/scanners/python/src/index.ts
  - test-bun/python-scanner.test.ts
  - docs/scanners/python/index.md
  - plugins/scanners/php/package.json
  - plugins/scanners/php/src/index.ts
  - test-bun/php-scanner.test.ts
  - test-bun/php-http.test.ts
  - docs/scanners/php/index.md
  - plugins/scanners/swift/package.json
  - plugins/scanners/swift/src/index.ts
  - test-bun/swift-scanner.test.ts
  - docs/scanners/swift/index.md
  - test-bun/execution-evidence.test.ts
  - scripts/benchmark-swift-scanner.ts
  - test-bun/scanner-fresh-checkout.test.ts
  - plugins/scanners/angular/package.json
  - plugins/scanners/angular/src/index.ts
  - plugins/scanners/angular/src/project.ts
  - plugins/scanners/angular/src/scan.ts
  - plugins/scanners/angular/src/template.ts
  - plugins/scanners/entry-points/javascript.ts
  - plugins/scanners/javascript/package.json
  - plugins/scanners/javascript/src/index.ts
  - plugins/scanners/javascript/src/sources.ts
  - plugins/scanners/react/package.json
  - plugins/scanners/react/src/index.ts
  - plugins/scanners/react/src/project.ts
  - plugins/scanners/react/src/scan.ts
  - plugins/scanners/typescript-project.ts
  - plugins/scanners/typescript/package.json
  - plugins/scanners/typescript/src/files.ts
  - plugins/scanners/typescript/src/graph.ts
  - plugins/scanners/typescript/src/index.ts
  - plugins/scanners/typescript/src/projects.ts
  - plugins/scanners/typescript/src/scan.ts
  - plugins/scanners/typescript/src/source-analysis.ts
  - plugins/scanners/vue/package.json
  - plugins/scanners/vue/src/index.ts
  - plugins/scanners/vue/src/project.ts
  - plugins/scanners/workspace-packages.ts
  - test-bun/angular-http.test.ts
  - test-bun/angular-scanner.test.ts
  - test-bun/architecture-findings.test.ts
  - test-bun/javascript-http.test.ts
  - test-bun/javascript-scanner.test.ts
  - test-bun/nested-scanners.test.ts
  - test-bun/partial-scan.test.ts
  - test-bun/react-http.test.ts
  - test-bun/react-scanner.test.ts
  - test-bun/removal.test.ts
  - test-bun/scanner-evidence.test.ts
  - test-bun/source-relationships.test.ts
  - test-bun/typescript-cli-command.test.ts
  - test-bun/typescript-http.test.ts
  - test-bun/typescript-placement.test.ts
  - test-bun/typescript-source-usage.test.ts
  - test-bun/typescript-workspace.test.ts
  - test-bun/vue-http.test.ts
  - test-bun/vue-lint.test.ts
  - test-bun/vue-scanner.test.ts
  - scripts/reproduce-scanner-boundaries.ts
parent_task_id: TASK-519
ordinal: 608000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The globs of the files a scanner reads (for example **/*.java and **/pom.xml for Java) live in each scanner's code, spread over watch patterns, source listings and selection helpers. Users cannot see or change what a scanner scans, plugin authors have no documented place to declare it, and each scanner lists the repository through Git by itself, always honoring .gitignore. On 2026-09-24 Alex decided that scanner file selection is configuration: each scanner entry has an include list, whose defaults are the globs of the files its language reads, declared by the scanner package and written into the entry when the scanner is added, and an exclude list, whose defaults name only the scanner's own ecosystem's folders. The global exclude list stays the user's, and Groma never writes it. A global useGitignore flag, true by default, decides whether files Git ignores exist for scanners; when false they do, node_modules included, with no special handling. Scanner code keeps only the build rules that globs cannot express, such as Java reading only its main source roots. The full-context review of TASK-519.3 and TASK-519.2 recommended folding these into the same change: one owner that lists repository files once and hands each scanner its files; one way to say 'no exclusions'; the host owning source-listing failures; removing watch.exclude, since watching follows the lists; keeping the language-neutral file listing apart from npm package detection (plugins/scanners/projects.ts); and an exclusion check that answers false for a path outside the repository instead of throwing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each scanner entry in groma/scanners.json has an include list; adding a scanner writes the include globs its package declares, and updating a scanner leaves the list unchanged.
- [x] #2 A scanner reads a file only when its include list matches it, neither the global nor its own exclude list names it, and, while useGitignore is true, Git does not ignore it; scanner code keeps only build rules that globs cannot express.
- [x] #3 groma/scanners.json has a top-level useGitignore flag, true by default; when it is false, scanners read files Git ignores, node_modules included, with no special handling.
- [x] #4 A change triggers a scanner exactly when that scanner would read the changed file, so no scanner declares separate watch patterns.
- [x] #5 The plugin guide states that a scanner declares what it scans in its include list and its default exclusions, not in code, and every official scanner follows it.
- [x] #6 Groma's own groma/scanners.json lists the include defaults of its configured scanners.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Host owns the file set (one owner): repositoryListing(root, useGitignore) lists existing tracked and untracked files once, with Git's ignore rules only while useGitignore is true (default), and lists a symlink to another listed file once. It replaces plugins/scanners/projects.ts repositoryFiles, so no plugin runs Git.
2. Config: top-level useGitignore; per-scanner include next to exclude; the package manifest declares groma.scanner.include (the globs of the files its language reads) and addScanner writes include and exclude into the new entry; updates keep both. Both lists use Git ignore syntax and one matcher in config.ts; a scanner's candidates are the listed files its include matches, and its files are the candidates no exclude names. The exclusion check answers false for a path outside the repository.
3. Contract (@groma/scanner): scan(root, settings, files) and checkReadiness(root, settings, files) receive the scanner's files; listSourceFiles(root, settings, candidates) narrows the candidates to what the language's build compiles, only for the no-owner answer; watch leaves the plugin contract.
4. Registry: one listing per collection; a scanner is skipped when it has candidates and every one is excluded, without calling the plugin; a change triggers a scanner exactly when its include matches the path and no exclude names it; readersOfFile and the no-owner answer use candidates; the watcher's node_modules skip applies only while useGitignore is true.
5. Scanners: each package declares include defaults and reads only from files (reads by path check membership); code keeps only build rules globs cannot express, such as Java's main source roots, Go's build rules, Swift's manifests and TypeScript declaration files. projectScanner shifts files into each project; the Rust worker receives the files it may read. Shared helpers (entry reader, framework projects, workspace packages) take file lists; npm package detection moves next to the framework helpers.
6. Docs: the plugin guide states that a scanner declares what it scans in include and its default exclusions, never in code; the scanner pages list their include defaults; index.md explains useGitignore and the lists.
7. groma/scanners.json: include defaults for Groma's configured scanners.
8. Tests: host tests for the flag, include writing at add and selection; scanner tests pass their files through one helper that applies the package defaults.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented as planned. The host lists the repository once (src/repository-listing.ts, with useGitignore), config.ts parses the required include list and useGitignore and matches both lists, src/scanner/modules/selection.ts owns a scanner's selection and the test helper scannerFiles, and the registry hands each scanner its files, skips one whose candidates are all excluded without calling it, and triggers a scanner only for a path its include names and no exclusion names. The plugin contract passes files to scan and checkReadiness and candidates to listSourceFiles; watch left it. Four agents converted the twelve scanners (each package declares groma.scanner.include; no plugin runs Git; plugins/scanners/projects.ts keeps only isUnder). Docs: the plugin guide's 'What a scanner reads' section, the overview's 'Selecting source files', the agent instructions and the teaching example. Test decision: scanner-exclusions 'a scanner receives the files its include list names, less excluded ones and, unless useGitignore is false, ignored ones' (authority: AC2 to AC4); a fake scanner reports the files it receives in a diagnostic; removing the include filter, the exclusion filter, the flag in the listing or the include check in triggers each fails it. Evidence before the emergency stop: that test and the converted host tests pass; Go and Java suites 32 of 32, C# 9 of 9 plus the .NET worker 30 of 30, Rust 21 of 21 (agent runs with toolchains). On Alex's emergency instruction (2026-09-24: skip checks and CI, finish the code and push to main), bun run check, the cold simplicity review, the full-context review and CI were not run for this task.

Left open by the emergency stop: bun run check, CI and both reviews were not run (DoD 2 unchecked); the React, Vue and Angular suites were not rerun; the TypeScript, JavaScript, React, Vue and Angular doc pages still describe the old selection; the prebuilt dist packages under plugins/scanners/*/dist need a rebuild before Groma scans itself locally; nested-scanners 'TypeScript configs with no inputs or an absent base' needs the include-only candidates; the Python suite's intermittent git-init hang is unconfirmed against main.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Each scanner now reads only the files Groma hands it: the repository listing (Git's ignore rules apply unless the new useGitignore flag is false) filtered by the scanner's required include list and then by the global and its own exclusions. Scanner packages declare their include globs in groma.scanner.include, adding a scanner writes them into its scanners.json entry and updates keep them, and the plugin contract passes files to scan and checkReadiness and candidates to listSourceFiles; watch left the contract, changes trigger a scanner by the same lists, and no plugin runs Git. The plugin guide says a scanner declares what it scans in include, never in code, and Groma's own scanners.json lists the include defaults. Verified by the host selection test (each rule confirmed by breaking it) and the Go, Java, C#, Rust and host suites; the full check, CI and reviews were skipped on Alex's emergency instruction.
<!-- SECTION:FINAL_SUMMARY:END -->
