---
id: TASK-519.3
title: Move native scanner exclusions into configurable defaults
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 12:35'
updated_date: '2026-09-24 18:31'
labels: []
dependencies: []
references:
  - scanners-projects
  - go-src-index
  - modules-readiness
  - scanner-src-index
  - src-index
  - swift-src-index
  - php-src-index
  - csharp-command
  - csharp-src-index
  - java-src-index
  - csharp-analysis
  - rust-src-index
  - rust-analysis
modified_files:
  - packages/scanner/src/index.ts
  - src/scanner/modules/readiness.ts
  - docs/scanners/creating-a-plugin.md
  - plugins/scanners/project-scanner.ts
  - test-bun/go-scanner.test.ts
  - plugins/scanners/go/package.json
  - plugins/scanners/go/src/sources.ts
  - plugins/scanners/go/src/adapter.ts
  - plugins/scanners/go/src/index.ts
  - docs/scanners/go/index.md
  - plugins/scanners/python/package.json
  - plugins/scanners/python/src/index.ts
  - test-bun/python-scanner.test.ts
  - docs/scanners/python/index.md
  - plugins/scanners/swift/package.json
  - plugins/scanners/swift/src/index.ts
  - docs/scanners/swift/index.md
  - test-bun/swift-scanner.test.ts
  - plugins/scanners/php/package.json
  - plugins/scanners/php/src/index.ts
  - docs/scanners/php/index.md
  - test-bun/php-scanner.test.ts
  - plugins/scanners/csharp/package.json
  - plugins/scanners/csharp/src/adapter.ts
  - plugins/scanners/csharp/src/index.ts
  - plugins/scanners/csharp/dotnet/ProjectGraph.cs
  - plugins/scanners/csharp/dotnet/ScanRequest.cs
  - docs/scanners/dotnet-csharp/index.md
  - test-bun/csharp-exclusions.test.ts
  - plugins/scanners/java/package.json
  - plugins/scanners/java/src/gradle.ts
  - plugins/scanners/java/src/java-input.ts
  - plugins/scanners/java/src/adapter.ts
  - plugins/scanners/java/src/index.ts
  - test-bun/java-scanner.test.ts
  - docs/scanners/java/index.md
  - test-bun/declared-source-listing.test.ts
  - test-bun/scanner-source-listing.test.ts
  - groma/scanners.json
  - plugins/scanners/rust/package.json
  - plugins/scanners/rust/src/project.ts
  - plugins/scanners/rust/src/index.ts
  - plugins/scanners/rust/native/src/scan.rs
  - test-bun/rust-workspace.test.ts
  - docs/scanners/rust/index.md
parent_task_id: TASK-519
ordinal: 603000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Native slice of the exclusion policy (csharp, go, java, php, python, rust, swift). What the language's own build compiles, such as Go test files, Java test source sets and Rust test targets, stays in the scanners.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The C#, Go, Java, PHP, Python, Rust and Swift scanners declare their test, fixture, generated, vendored and build-output exclusions as defaults and no longer skip those files in code.
- [x] #2 Each applies its effective exclusions to everything it reads, including project files and manifests.
- [x] #3 Groma's own `groma/scanners.json` lists the defaults of its configured native scanners.
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
1. Contract: checkReadiness(root, settings, excluded) receives the scanner's predicate, and readiness.ts passes the record's excluded.
2. projectScanner (Go, Java): select(root, settings, excluded) picks projects whose declarations are not excluded, and each project's readiness and scan get the predicate shifted into the project folder (within).
3. Each native scanner: its package declares the policy as groma.scanner.exclude; code keeps only language coverage; sources, project and build files and manifests come from repositoryFiles less the predicate; watch.exclude is empty; listSourceFiles lists before exclusions.
   - C#: 16 defaults; the configured input and every project load only from the filtered inventory; a project's imported .props/.targets stay build context.
   - Go: vendor/; module selection and module sources filtered; tests, testdata and dot or underscore names stay go command coverage.
   - Java: target/, build/, .gradle/, node_modules/, vendor/, generated/; POMs, Gradle scripts and sources under declared roots filtered; only main source roots stay built in.
   - PHP: vendor/, node_modules/, build/, dist/, coverage/, generated/; a composer.json that is not JSON names no command, so the listing never fails on one.
   - Python: 14 defaults (environments, caches, tests, dependency, build and generated folders).
   - Rust: target/, node_modules/, vendor/, dist/; discovered and configured manifests, members, path dependencies and the enclosing workspace filtered; the worker receives the excluded .rs files and skips their modules; the listing names nothing of a project Cargo cannot build; target selection and cfg(test) stay.
   - Swift: .build/, Pods/, Carthage/, node_modules/, build/, dist/, vendor/, generated/; Package.swift manifests and .docc catalogs stay.
4. groma/scanners.json: the csharp, go, java and rust entries carry their defaults, edited in place so the C# input and Rust manifest settings stay.
5. Docs per scanner link to the shared exclusion section; the plugin guide documents the readiness predicate and a matching example.
6. Tests, one per scanner, each with a broken input in an excluded location beside valid sources and a ! restore; the shared listing test copies fixtures as Git lists them.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Handoff from the TASK-519.1 full-context review. The first scanner slice to start adds the exclusion argument to checkReadiness (contract, and readiness.ts passing the record's excluded) together with its first reader. The slice that lands last deletes the shared folder set in plugins/scanners/projects.ts; its groma, .groma and .git entries are Groma's own state rather than policy and need an explicit home. plugins/scanners/project-scanner.ts (Go, Java) and Java's own scan drop the predicate today, and projectScanner runs each project with its folder as root, so it must pass file => excluded(path.posix.join(key, file)). Remove the exclusion rules from watch.exclude in the same change, or a ! restore changes what is read without triggering a rescan. Update Groma's own groma/scanners.json by editing entries in place; removing and re-adding would drop the C# input and Rust manifest settings. Prove it with a broken input in an excluded folder beside valid sources, plus a !-restored file that must appear: output-only checks pass even when a scanner ignores the predicate, because the host filters evidence anyway. Everything a scanner reads means the inputs it selects, not files a compiler reads as context.

Test decisions (rule and authority, the wrong result it catches, the gap it closes). Authority for all: TASK-519 AC3 and AC4 and this task's AC1 and AC2 (policy only in defaults, the predicate reaches everything a scanner selects). Output-only assertions cannot prove it, because the host filters evidence anyway, so each test puts an input that fails the scan if read in an excluded place:
- go-scanner 'Go lists vendored source, and reads only the go.mod and .go files its exclusions keep': a vendored source with a syntax error and a vendored go.mod without a module line; wrong result: the scan fails, or the !-restored api.pb.go is missing; gap: Go had no predicate test.
- python-scanner 'Python skips Git-ignored and excluded inputs, project declarations included, and reads tracked or restored source': broken sources in default folders and a broken build/pyproject.toml; wrong result: the scan fails or test_restored.py is missing; also asserts the listing names excluded tests and that a restored file triggers a rescan (watch.exclude emptied).
- swift-scanner (host flow): the entry's defaults exclude Pods/ and Carthage/, and !Carthage/ restores Carthage/Restored.swift; wrong result: it is missing.
- php-scanner 'the PHP scan reads nothing the default exclusions name, and a ! pattern restores a default folder': a vendored composer.json that is not JSON and a vendored source with a syntax error; wrong result: the scan fails, or generated/Model.php is missing, or the listing throws (the host lists before every scan; this assertion failed before the fix). The readiness call was removed because it could not fail (cold review finding).
- csharp-exclusions (new, needs a packaged build like the other C# tests): a project with broken XML under tests/, a broken source under App/obj/ that App compiles, a !-restored designer file; an excluded settings.input gives no scan and a failing readiness check; each assertion failed on the old code.
- java-scanner 'Java reads no build script or source its exclusions name, while a ! pattern restores a generated root': a broken source under build/generated/java and a vendored build.gradle; wrong result: the scan fails or leaks the vendored script's warning, or the restored root is missing.
- rust-workspace 'Rust lists vendored source, reads no manifest or module its exclusions name, and reads a restored file' (gated by GROMA_TEST_RUST): a vendored crate and an excluded module with invalid syntax; wrong result: RUST_ANALYSIS_FAILED, or the restored module is missing.
- declared-source-listing 'the Rust listing names no file of a manifest Cargo cannot build' (runs without cargo): a vendored Cargo.toml that is not TOML and one with no target; wrong result: the listing throws 'TOML Parse error' (confirmed before the fix), which fails every host scan.
- scanner-source-listing: the C# row now lists tests/App.Tests/CallsTests.cs (listings come before exclusions); the helper copies each fixture as Git lists it, because a fixture's ignored local build output (csharp-operations obj/) would otherwise appear in a listing.

Corrections during integration: (1) The PHP and Rust listings, which read manifests before exclusions, failed the host scan on a broken manifest inside an excluded folder (the host lists before every scan). Both now follow the rule TASK-520 set for workspace packages: a manifest the build cannot read names nothing (PHP: a composer.json that is not JSON names no command; Rust: a project whose manifest is not TOML or has no target lists nothing); a scan that selects such a manifest still fails with its parse error. (2) The shared listing test copied ignored local build output (csharp-operations obj/) into its temporary repositories; it now copies each fixture as Git lists it. (3) Cold simplicity review applied: removed a PHP readiness assertion that could not fail, inlined runRust, stated why the Rust worker skips an excluded binary root, noted PHP's two manifest error rules, renamed project-folder parameters (projectRoot, moduleRoot) in the Java and Go adapters, and replaced the repeated 'adding the scanner writes them' sentence in each scanner page with a link to the shared exclusion section.
Verification: bun run check on a commit of main (9ae4013f) plus only this task's files passes: 736 pass, 48 skip (toolchain-gated suites), 0 fail; tsc and Biome clean except three older warnings in files this task does not touch. The toolchain suites ran in the shared tree with GROMA_TEST_GO and GROMA_TEST_RUST set: go-scanner, rust-scanner, rust-workspace, declared-source-listing, php-scanner, python-scanner and java-scanner, 67 pass, 0 skip, 0 fail. The C# agent ran its suites with a packaged build (9 of 9) and dotnet test (30 of 30); the Swift agent ran its suite with the Swift toolchain.

Correction to the verification above: the Swift sentence was not verified from a record; instead the Swift suite (test-bun/swift-scanner.test.ts, which builds its package with the local Swift toolchain) ran in the shared tree: 5 pass, 0 fail.

Rerun after the TASK-519.2 cold review and on main 48ea5bcf (commit ff1e4075, this task's files only): bun run check 738 pass, 48 skip, 0 fail.

Alex's decision (2026-09-24) after the full-context review: a scanner's defaults name only its own ecosystem's files and folders. The agents had copied the old shared folder set (node_modules, vendor, target, dist, build, obj, .gradle, .angular, coverage, generated) into every scanner. Native defaults now: Python .venv/, venv/, __pycache__/, test/, tests/, test_*.py, *_test.py, conftest.py, build/, dist/; Go vendor/; Rust target/, vendor/; Java target/, build/, .gradle/; C# bin/ and obj/ in any letter case, the test folders, *.Designer.cs, *.g.cs, *.g.i.cs, *.generated.cs; PHP vendor/; Swift .build/, Pods/, Carthage/. Groma's own scanners.json entries, the scanner pages and the tests follow: PHP drops its generated-folder restore; Java's excluded build script moves to target/ and its restore now brings back a package folder named build that the default build/ names; Python's broken inputs leave node_modules. Visible include lists and a useGitignore flag are TASK-519.4.

Verification after the defaults decision, on main be1ba357 (commit 6d601b83, this task's files only): bun run check 738 pass, 48 skip, 0 fail; the Java and Swift suites pass in the shared tree, and removing Gradle discovery's predicate fails the reworked Java test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The seven native scanners (C#, Go, Java, PHP, Python, Rust, Swift) no longer hide tests, generated, vendored or build files in code. Each package declares that policy as default exclusions naming only its own ecosystem's folders and files (Alex's rule), which adding the scanner writes into its scanners.json entry; code keeps only language coverage. Each scanner applies its effective exclusions to everything it selects and reads: sources, project and build files and manifests, in its scan and in checkReadiness, which now receives the predicate; projectScanner shifts it into each project folder for Go and Java, the C# worker loads only projects from the filtered inventory, and the Rust worker skips excluded modules. Source listings name files before exclusions, and a manifest the build cannot read names nothing, so a broken manifest in an excluded folder no longer fails the host scan (PHP, Rust). Groma's own csharp, go, java and rust entries carry their defaults. Verified by one proof test per scanner with broken inputs in excluded places and a ! restore, each confirmed to fail without its predicate or on the old code, and by bun run check on a commit of main plus only this task (738 pass, 0 fail) with the Go, Rust, Java, PHP, Python and Swift suites run with their toolchains.
<!-- SECTION:FINAL_SUMMARY:END -->
