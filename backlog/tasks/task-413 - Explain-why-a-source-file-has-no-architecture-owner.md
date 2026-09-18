---
id: TASK-413
title: Explain why a source file has no architecture owner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-18 23:06'
labels: []
dependencies: []
references:
  - scanner-registry
  - src-core
  - scanner-src-index
  - javascript-src-index
  - angular-src-index
  - react-src-index
  - vue-src-index
  - java-src-index
  - rust-src-index
  - csharp-src-index
  - go-src-index
  - php-src-index
  - typescript-src-index
  - scanners-projects
  - modules-discovery
modified_files:
  - src/scanner/registry.ts
  - src/source-coverage.ts
  - src/plain-world.ts
  - test-bun/source-coverage.test.ts
  - docs/agent-instructions/inspect.md
  - test-bun/scanner-source-watch.test.ts
  - packages/scanner/src/index.ts
  - docs/scanners/creating-a-plugin.md
  - plugins/scanners/typescript/src/index.ts
  - plugins/scanners/php/src/index.ts
  - plugins/scanners/python/src/index.ts
  - plugins/scanners/go/src/index.ts
  - plugins/scanners/java/src/index.ts
  - plugins/scanners/rust/src/index.ts
  - plugins/scanners/csharp/src/index.ts
  - test-bun/scanner-source-listing.test.ts
  - plugins/scanners/javascript/src/index.ts
  - plugins/scanners/typescript-project.ts
  - plugins/scanners/angular/src/index.ts
  - plugins/scanners/react/src/index.ts
  - plugins/scanners/vue/src/index.ts
  - plugins/scanners/swift/src/index.ts
  - plugins/scanners/projects.ts
  - plugins/scanners/java/src/maven.ts
  - plugins/scanners/rust/src/project.ts
  - test-bun/declared-source-listing.test.ts
  - test/fixtures/java-declared-roots/aggregate/pom.xml
  - test/fixtures/java-declared-roots/aggregate/src/main/java/C.java
  - test/fixtures/java-declared-roots/basedir/pom.xml
  - test/fixtures/java-declared-roots/basedir/source/A.java
  - test/fixtures/java-declared-roots/basedir/src/main/java/Unread.java
  - test/fixtures/java-declared-roots/gen/build/generated/java/G.java
  - test/fixtures/java-declared-roots/gen/pom.xml
  - test/fixtures/java-declared-roots/property/code/B.java
  - test/fixtures/java-declared-roots/property/pom.xml
  - test/fixtures/rust-declared-roots/app/Cargo.toml
  - test/fixtures/rust-declared-roots/app/core/lib.rs
  - test/fixtures/rust-declared-roots/app/core/model.rs
  - test/fixtures/rust-declared-roots/app/src/bin/extra.rs
  - test/fixtures/rust-declared-roots/app/tools/cli.rs
  - test/fixtures/rust-declared-roots/worker/Cargo.toml
  - test/fixtures/rust-declared-roots/worker/src/lib.rs
  - plugins/scanners/java/java/md/groma/scanner/MavenModel.java
  - plugins/scanners/java/src/java-input.ts
  - test/fixtures/java-declared-roots/entity/pom.xml
  - test/fixtures/java-declared-roots/entity/src/a&b/E.java
  - test/fixtures/java-declared-roots/cdata/pom.xml
  - test/fixtures/java-declared-roots/cdata/src/cd/D.java
  - test/fixtures/java-root-source/pom.xml
  - test/fixtures/java-root-source/Root.java
  - plugins/scanners/java/src/adapter.ts
  - plugins/scanners/java/java/md/groma/scanner/Main.java
  - test/fixtures/java-declared-roots/whole/pom.xml
  - test/fixtures/java-declared-roots/whole/W.java
  - src/repository-listing.ts
  - src/scanner/modules/discovery.ts
  - test-bun/java-gradle.test.ts
type: enhancement
ordinal: 468000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`groma view <file>` reads only stored architecture (`src/plain-world.ts`). A mistyped path, a file no enabled scanner reads, an excluded file and a new file waiting for a scan all answer `unknown target`, so agents cannot tell a typo from a coverage gap. Scanner watch patterns are not an accurate source selection: Java watches every `.java` file, including test sources it never reads. Storing the scanned file list would rewrite thousands of lines on each scan.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each official scanner can list the repository files it would analyze for the current settings without analyzing them or executing project tools.
- [x] #2 `groma view <file>` for a file without an owner reports one reason: not a repository file, excluded by a named `scanners.json` pattern, read by no enabled scanner, or read by named scanners but not scanned yet.
- [x] #3 Owned files still resolve to their architecture record.
- [x] #4 The scanner plugin contract and command documentation describe the file listing and the messages.
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
1. Contract: ScannerPlugin gains listSourceFiles(repositoryRoot, settings), required of official scanners, returning the repository-relative files the scanner would analyze now, selected the way scan selects them, without analyzing a file or running a project tool.
2. src/scanner/registry.ts exposes sourceFiles(root): each scanner that can list, bound to its configured settings, with shared exclusions applied.
3. src/source-coverage.ts asks four questions in order and returns exactly one reason: git ls-files membership, then each scanners.json exclude pattern matched alone so the answer names it, then the scanners that list the file, then the waiting-for-a-scan case.
4. src/plain-world.ts calls it only when no element owns the file, so element, flow, draft and owned-file answers stay as they are.
5. Every official scanner lists from its own selection: TypeScript, PHP, Python, Go, Java, Rust, C#, JavaScript, and Angular, React and Vue through a shared plugins/scanners/typescript-project.ts helper that lists each framework project's sources and companion templates and stylesheets.
6. Tests: the four messages with generated plugins, an owned file after a scan, and one exact listing per official scanner against its existing fixture.
7. Docs: the plugin contract describes the listing and the four reasons; the inspect guide documents the messages.
8. Run focused tests, then bun run check in an isolated worktree.

Review-fix round (external reviews of cf8e7975):
9. Java listing (Codex, Grok): the listing read Maven's sourceDirectory with a regex that expanded only a leading ${project.basedir}/, so ${basedir}, a ${property} value and an aggregator (packaging pom) disagreed with the worker's MavenModel; and it filtered through projectFiles, whose discovery exclusions (build, generated, target, dist...) dropped files the scan reads under a declared root. The listing now applies MavenModel's rules in TypeScript (the worker needs a JVM, and a listing must answer groma view without one) and keeps every tracked, unignored .java file under a declared root. A new repositoryFiles helper in plugins/scanners/projects.ts lists files without the discovery exclusions; projectFiles builds on it.
10. Rust listing (Codex): it ignored settings.manifest and listed only each Cargo.toml's src tree, missing an explicit [lib] path, [[bin]] paths and, through the same exclusions (bin), src/bin files. It now lists .rs files under the root-module directory of every target the scan analyzes for the settings (rustProjects, members and targets from project.ts).
11. Wording (Grok): a detached file is read by a scanner and waits for the next scan, but the fourth reason said "not scanned yet". The message and docs now say the file waits for a scan.
12. Ask, not implemented: a listing that throws makes groma view fail (Grok); catching it is fallback behavior that needs the owner's decision.
13. Tests: a new listing test writes minimal Maven and Cargo repositories and asserts the selected files.

14. Cold review: maven.ts became the only owner of the Maven source root and aggregator rules; the scan (java-input.ts mavenProject) takes its roots from it and MavenModel.java keeps only release, encoding and name. maven.ts decodes XML entities and CDATA. Java and Rust share isUnder from projects.ts, so a root at the repository directory lists its files. targetRoots reuses readRustProject per selected manifest. The approved listing-failure explanation replaces step 12: a scanner whose listing throws is named with its error's first line beside the other scanners' answer.

15. Simplicity round: maven.ts becomes the only POM reader (source roots, release, encoding and name, with ${basedir} resolved before property substitution); MavenModel.java, the worker's model command and the JVM start in mavenProject are deleted. java-input.ts exports one readJavaProject (the Maven-or-Gradle decision) that the scan and the listing share. registry.readersOfFile lists the scanners in id order once and drops the unreachable exclusion check; missingOwnerReason builds one list of reasons; repositoryFileSet and discovery share one git listing (src/repository-listing.ts). Coverage tests assert the reason's key facts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Core slice done; ACs 2 and 3 checked. AC 1 and the contract half of AC 4 are blocked: packages/scanner/src/index.ts and docs/scanners/creating-a-plugin.md both carry another lane's uncommitted compared-operations doc comments, and a plugin cannot add a hook that the ScannerPlugin interface does not declare, because each plugin uses satisfies.
src/source-coverage.ts asks four questions in order and returns exactly one reason: git ls-files membership (tracked and unignored, the same boundary a scan selects from), then each scanners.json exclude pattern matched alone so the answer names the pattern, then the enabled scanners that list the file, then the waiting-for-a-scan case. src/plain-world.ts calls it only when no element owns the file, so element, flow, draft and owned-file answers are unchanged. src/scanner/registry.ts exposes sourceFiles(root), binding each scanner's configured settings and dropping shared exclusions, and carries a temporary local type for the hook until the contract file is free.
Messages: 'unknown target: <target>; not a repository file', 'no owner: <file>; excluded by scanners.json pattern <pattern>', 'no owner: <file>; no enabled scanner reads it', 'no owner: <file>; read by <scanners> and not scanned yet, so run groma scan'.
Evidence: test-bun/source-coverage.test.ts covers all four messages, a mistyped id, a mistyped path and an owned file after a scan. test-bun/scanner-source-watch.test.ts's fake registry gained the new member. Isolated bun run check exited 0 (Bun 461 passed, 30 skipped, 0 failed; Node 16 passed). docs/agent-instructions/inspect.md documents the four reasons.

Contract landed: ScannerPlugin gained listSourceFiles(repositoryRoot, settings), the temporary local type and its TODO are gone, and docs/scanners/creating-a-plugin.md has a Source file listing section stating the rule (select as scan selects, analyze nothing, run no project tool, leave out tests and generated output), that a listing may still name a file the analysis finds unreachable, the four groma view reasons, and that a plugin without the hook contributes nothing to that answer.
Seven official scanners list their files from the selection their own scan uses: TypeScript (listTypeScriptFiles), PHP and Python (their inventory helpers, Python filtered to .py because declaration files describe projects), Go (module directories, skipping dot directories, testdata and _test.go, matching the worker's walk), Java (Maven's declared sourceDirectory or src/main/java, Gradle's parsed source roots, so test sources are excluded), Rust (each crate's src tree) and C# (project directories from the configured inputs, solutions read as text, excluding bin and obj). Angular, React, Vue and JavaScript remain.
Approximations recorded in the contract: a Rust module no crate root declares and a C# file excluded by an MSBuild item glob can appear in a listing, because deciding either needs analysis or a build.
Evidence: test-bun/scanner-source-listing.test.ts asserts the exact listing for each of the seven scanners against its existing fixture, with no worker or project tool run. Isolated bun run check exited 0 (Bun 488 passed, 32 skipped, 0 failed; Node 16 passed; Biome findings only in untouched files).
Verification note: an isolated worktree whose bun install --frozen-lockfile failed (HEAD's lockfile no longer matches package.json) produced a false Swift discovery failure. Recreating the worktree with a plain bun install reproduced a clean pass with and without this change.

Re-verified from current HEAD (6806c41f) with bun install --frozen-lockfile: install clean, bun run check exited 0 (Bun 488 passed, 32 skipped, 0 failed; Node 16 passed). The earlier Swift discovery failure was a worktree created before the JavaScript and Swift scanner packages were committed, not a lockfile problem.

JavaScript scanner lists its files with the same authored selection scan uses (javaScriptSources), so a .min name, minified text recognized by line length, and a TypeScript file stay out. Its listing test asserts exactly the four authored files of test/fixtures/javascript-source. Eight official scanners now list their files; Angular, React and Vue remain.

Angular, React and Vue list per framework project through plugins/scanners/typescript-project.ts: every source of the scanner's kind inside a project directory plus companion templates and stylesheets, with a project-relative rule for extras. React adds the Next.js files whose location declares a route (app/**/route.ts|tsx and pages/api/**), so middleware and declaration files stay out. Vue lists .vue, .ts and .js, which covers a Nuxt project's server/api and server/routes below the repository root. A first attempt read each tsconfig instead and missed an imported component, so the listing selects by extension inside the project and leaves program resolution to the analysis, matching the limit the contract already states.
Eleven official scanners now list their files; test-bun/scanner-source-listing.test.ts asserts one exact listing each. Final isolated bun run check from current HEAD with a frozen install exited 0 (Bun 510 passed, 32 skipped, 0 failed; Node 16 passed; Biome findings only in untouched files). Live check in this repository: groma view plugins/scanners/typescript-project.ts answers 'no owner: ...; read by typescript and not scanned yet, so run groma scan'.

Cold review applied; AC 1 now covers twelve official scanners, not eleven.
1. Swift lists its files with its own files(root) selection, which excludes Package.swift and the .build, Pods and Carthage directories. Its fixture row asserts the two Swift sources.
2. The shared framework helper no longer adds companion extensions. Angular and Vue name them in their own sources, so React lists only its TSX components and Next.js route files; a test writes globals.css into a React project and asserts it is absent while an Angular stylesheet is present.
3. Exclusion is decided with the combined pattern list, so a documented negation restores its file, and the answer then names the last matching non-negated pattern. A test covers both directions with **/*.generated.ts and !src/keep.generated.ts. A negation cannot restore a file inside an excluded directory, which is Git's own rule and what the scanners apply.
4. The contract now tables every approximation: Rust modules no crate root declares, Go files its build constraints exclude, C# files an MSBuild item glob excludes, and Angular and Vue templates or stylesheets no component declares. It also states the rule that a listing must never leave out a file the scan reads.
5. docs/agent-instructions/inspect.md has the blank line the reason table needs.
6. The registry member is now readersOfFile(root, file), returning the scanner ids that read that file, which removed the tuple type, the filter and the caller's includes.
7. Verified live through the CLI in this repository after rebuilding the bundled framework packages, because a packaged scanner loads from dist and its hook only takes effect after a rebuild: 'unknown target: src/source-coverag.ts; not a repository file'; 'no owner: test-bun/source-coverage.test.ts; excluded by scanners.json pattern /test-bun/'; 'no owner: README.md; no enabled scanner reads it'; 'no owner: plugins/scanners/typescript-project.ts; read by typescript and not scanned yet, so run groma scan'. The rebuilt bundles are ignored build output and are not part of this commit.
Follow-up recorded, not implemented: a scanner whose listSourceFiles throws makes groma view fail instead of answering, and a fallback needs the owner's decision.
Isolated bun run check exited 0 (Bun 513 passed, 32 skipped, 0 failed; Node 16 passed).

Review-fix round (external reviews of cf8e7975).
Fixed, Java listing (Codex u09, Codex-all #13, Grok u09): the listing read Maven's sourceDirectory with its own regex (only a leading ${project.basedir}/ expanded) and filtered through projectFiles, whose discovery exclusions (build, generated, target...) dropped files under declared roots. plugins/scanners/java/src/maven.ts is now the only owner of the source root and aggregator rules: mavenSourceRoots reads project/build/sourceDirectory (or src/main/java) with whole-value ${property} substitution, ${basedir} and ${project.basedir}, XML entities and CDATA, and returns none for packaging pom. The scan's mavenProject (java-input.ts) takes its roots from it and skips the JVM for an aggregator; MavenModel.java keeps release, encoding and name only. The listing keeps every tracked, unignored .java file under a declared root (new repositoryFiles in plugins/scanners/projects.ts; projectFiles builds on it).
Fixed, Rust listing (Codex u09, Codex-all #13): it ignored settings.manifest and listed only each Cargo.toml's src tree, missing [lib] and [[bin]] paths and src/bin (dropped by the bin exclusion). It now lists .rs files under the directory of each target root module that readRustProject returns for every selected manifest (targetRoots in project.ts). A manifest without targets is a listing failure, as it is a scan failure. Java and Rust share isUnder, which treats the repository root as containing every file.
Fixed, wording (Grok-all): the fourth reason now says the file is waiting for a scan, which is also true of a detached file.
Fixed, approved by the coordinator (Grok-all): a scanner whose listSourceFiles throws no longer makes groma view fail. registry.readersOfFile returns { readers, failures } and the reason names each failed scanner with its error's first line ('<scanner> could not list its sources: <message>'), after the waiting-for-a-scan reason when other scanners read the file.
Tests: test-bun/declared-source-listing.test.ts with fixtures java-declared-roots (basedir, property, entity, CDATA, build-directory root, aggregator), java-root-source and rust-declared-roots; a scan-side test builds the worker and checks readJavaInput reads exactly the listed files. test-bun/source-coverage.test.ts gained the listing-failure case. All fail at cf8e7975 and pass now.
Live check: groma view on the Java fixture with the source Java scanner added answered 'waiting for a scan' for the basedir, property and build-root files and 'no enabled scanner reads it' for the aggregator's file. Re-review confirmed readJavaInput output is identical to cf8e7975 on 27 projects including callforpapers.
Verification: isolated worktree at 9574e0a1 with only this change, bun run check exit 0 (biome 1 warning and 2 infos in untouched files, tsc clean, node 16 pass, bun 574 pass 35 skip 0 fail). plugins/scanners/java/dist/worker.jar is gitignored and still the previous build; rebuild it before a live rescan uses the trimmed model.
Not in this lane: Grok-all's cut file answer ending on the paging footer belongs to TASK-425/TASK-420.

Simplicity round (cold junior-maintainer review of the fix round).
Fixed defect D2: a sourceDirectory of exactly ${basedir} or ${project.basedir} went through the property loop first, found no such property and fell back to src/main/java. maven.ts now resolves basedir before and during property substitution; fixture java-declared-roots/whole lists whole/W.java, which fails at 70fb5408.
Simplified: maven.ts (readMavenProject) is the only POM reader. It reads the source root, the language version and encoding (maven-compiler-plugin configuration, then maven.compiler.release, java.version, maven.compiler.source and project.build.sourceEncoding) and the artifactId from a small element tree, so MavenModel.java, the worker's model command and the JVM start in mavenProject are deleted, and readJavaInput needs no worker. java-input.ts exports readJavaProject, the one Maven-or-Gradle decision the scan and the listing share. registry.readersOfFile lists the scanners once in id order and drops an exclusion check its only caller makes first. missingOwnerReason builds one list of reasons. src/repository-listing.ts is the one git listing that source coverage and scanner discovery share. Coverage tests assert the reason's key facts (pattern, scanner ids, the failure line) instead of whole sentences; a readMavenProject test covers the version, encoding and name.
Verification: isolated worktree at fe407bc9 with only this change, bun run check exit 0 (biome 1 warning and 2 infos in untouched files, tsc clean, node 16 pass, bun 591 pass 35 skip 0 fail), including the Java suites that scan Maven fixtures through the built package.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma view <file> now explains why a file has no architecture owner instead of answering 'unknown target'. src/source-coverage.ts asks four questions in order and returns exactly one reason: the file is not in the repository listing (tracked and unignored, the boundary every scan selects from), a named scanners.json pattern excludes it, no enabled scanner reads it, or the scanners that read it have not scanned it yet. src/plain-world.ts consults it only when no element owns the file, so element, flow, draft and owned-file answers are unchanged. The evidence comes from a new ScannerPlugin hook, listSourceFiles, which every official scanner implements from the selection its own scan uses, without analyzing a file or running Maven, Gradle, dotnet, go or cargo: TypeScript, PHP, Python, Go, Java, Rust, C#, JavaScript, and Angular, React and Vue through a shared framework-project helper. src/scanner/registry.ts exposes those listings with each scanner's configured settings and the shared exclusions applied. Verified by test-bun/source-coverage.test.ts (all four messages, a mistyped id, a mistyped path, and an owned file after a scan) and test-bun/scanner-source-listing.test.ts (one exact listing per official scanner against its existing fixture, with no worker or project tool running), plus an isolated bun run check at current HEAD: exit 0, Bun 510 passed, Node 16 passed. The plugin contract and the inspect guide document the listing rule, its limits and the four messages.

Review-fix round: the Java and Rust listings now select exactly what their scans read. maven.ts is the single owner of the Maven source root (basedir, properties, entities, CDATA, aggregators) for scan and listing, declared roots inside build directories are listed, and the Rust listing follows the configured manifest to every target's root module. A detached file is described as waiting for a scan, and a scanner whose listing throws is named with its error instead of crashing groma view. New fixture tests fail at cf8e7975 and pass now, and an isolated bun run check exits 0.

Simplicity round: maven.ts is now the only POM reader (source root, version, encoding and name, with an exact ${basedir} source root no longer falling back to src/main/java), the Java worker lost its model command, and source coverage and scanner discovery share one git listing.
<!-- SECTION:FINAL_SUMMARY:END -->
