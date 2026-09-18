---
id: TASK-417
title: Scan Gradle Java projects without running Gradle
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 18:14'
labels: []
dependencies: []
references:
  - java-src-index
  - src-gradle
modified_files:
  - plugins/scanners/java/package.json
  - bun.lock
  - plugins/scanners/java/src/gradle.ts
  - plugins/scanners/java/src/maven.ts
  - plugins/scanners/java/src/adapter.ts
  - plugins/scanners/java/src/index.ts
  - plugins/scanners/java/java/md/groma/scanner/Main.java
  - plugins/scanners/java/java/md/groma/scanner/Uses.java
  - plugins/scanners/java/build.ts
  - test/fixtures/java-gradle-groovy/app/build.gradle
  - test/fixtures/java-gradle-groovy/app/src/main/java/shop/App.java
  - test/fixtures/java-gradle-groovy/build.gradle
  - test/fixtures/java-gradle-groovy/libs/core/build.gradle
  - test/fixtures/java-gradle-groovy/libs/core/src/java/shop/core/Core.java
  - >-
    test/fixtures/java-gradle-groovy/libs/core/src/main/java/shop/core/Replaced.java
  - test/fixtures/java-gradle-groovy/settings.gradle
  - test/fixtures/java-gradle-kotlin/build.gradle.kts
  - test/fixtures/java-gradle-kotlin/settings.gradle.kts
  - test/fixtures/java-gradle-kotlin/src/extra/java/tool/Extra.java
  - test/fixtures/java-gradle-kotlin/src/main/java/tool/Main.java
  - test-bun/java-gradle.test.ts
  - docs/scanners/java/index.md
  - docs/scanners/discovery.md
  - plugins/scanners/java/src/java-input.ts
  - plugins/scanners/java/java/md/groma/scanner/MavenModel.java
  - >-
    test/fixtures/java-gradle-groovy/libs/core/src/checks/shop/core/CoreCheck.java
  - test/fixtures/java-gradle-unresolved/build.gradle
  - test/fixtures/java-gradle-unresolved/src/main/java/hidden/Replaced.java
  - README.md
  - test/fixtures/java-gradle-scopes/build.gradle
  - test/fixtures/java-gradle-scopes/src/main/java/scopes/Main.java
  - test/fixtures/java-gradle-scopes/other/scopes/Other.java
type: feature
ordinal: 482000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Java scanner only recognizes Maven `pom.xml` projects, so a repository built with Gradle gets no Java evidence at all. Gradle build files are Groovy or Kotlin programs. Running Gradle would execute repository code and download the pinned Gradle distribution and plugins during a scan, which the fresh-checkout rule for scanners forbids (`docs/scanners/index.md`); C# and Rust follow the same rule by never running MSBuild or Cargo. Renovate reads Gradle builds statically at scale with the MIT-licensed `good-enough-parser` library; Renovate itself is AGPL-3.0, so its Gradle queries cannot be copied.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Java projects declared by `settings.gradle`, `settings.gradle.kts`, `build.gradle` or `build.gradle.kts` are scanned without running Gradle, downloading anything or executing repository code.
- [x] #2 Included projects, Java source directories and the Java language version come from literal declarations, and Gradle's conventional `src/main/java` applies when a project declares no source directory.
- [x] #3 A declaration that only a Gradle run could resolve produces a diagnostic naming the build file, while literal and conventional source directories are still scanned.
- [x] #4 Editing a Gradle build or settings file triggers a Java rescan during watch.
- [x] #5 Independent fixtures cover Groovy and Kotlin builds, multi-project includes, custom literal source sets and unresolvable declarations.
- [x] #6 Java scanner documentation, discovery and the README language table describe Gradle support and its limits.
- [x] #7 Gradle build and settings files are read with the MIT-licensed `good-enough-parser` library shipped inside the Java scanner package.
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
1. Add good-enough-parser 1.1.23 to @groma/scanner-java (package.json, bun.lock).
2. plugins/scanners/java/src/gradle.ts: parse settings and build scripts (Groovy and Kotlin) with the library's groovy tokenizer and tree. A small statement reader turns blocks (literal block-call arguments join the path), dotted chains with literal selectors, assignments, .set(...) and command calls into declaration paths. Readers return why a declaration was not fully read. Settings scripts: literal rootProject.name and include paths at any depth; projectDir/buildFileName assignments are reported as not applied. Build scripts: main Java srcDir/srcDirs (add) and srcDirs =/setSrcDirs (replace, default src/main/java), and the Java version from options.release, else sourceCompatibility, else toolchain languageVersion (numbers including 1.8, strings, JavaVersion.VERSION_N, JavaLanguageVersion.of(N)). Literal values are comma-separated strings, bracketed lists and file/files/listOf/setOf calls; anything else is incomplete. Non-literal values, and build declarations inside subprojects/allprojects/project(':x') blocks, produce a JAVA_GRADLE_UNRESOLVED warning naming the script and line; literal parts still apply.
3. Project selection (src/index.ts): Maven pom.xml directories plus existing Gradle directories (every build or settings script directory and literal includes at Gradle's default directories). withGradleDiagnostics attaches Gradle warnings to the combined Java observation, or returns a files-free observation (engine good-enough-parser) when no project produced evidence. Watch includes build.gradle(.kts) and settings.gradle(.kts).
4. src/java-input.ts (renamed from maven.ts) readJavaInput: pom.xml selects the Maven model; any other selected directory is read as a Gradle project (name from rootProject.name or directory, UTF-8, source roots). An empty release selects the bundled compiler version in Main.java (MavenModel returns empty when undeclared). The adapter sets the root name, kind and declaration file; the worker no longer hardcodes pom.xml; JAVA_SOURCE_SET drops 'Maven'. Each project rereads its own scripts because the shared project scanner passes only its directory.
5. build.ts: write THIRD-PARTY-NOTICES.txt from the bundle metafile.
6. Discovery: text rule for build.gradle(.kts); docs/scanners/discovery.md row.
7. Fixtures and tests: test/fixtures/java-gradle-groovy, java-gradle-kotlin and java-gradle-unresolved; test-bun/java-gradle.test.ts covers selection, inputs, version and source literal forms, nested non-literal calls, report delivery without evidence, and watch patterns.
8. Docs: docs/scanners/java/index.md Gradle section; README row 'Java (Maven, Gradle)'.
9. Rebuild the Java package, verify bundle and notices, scan fixtures offline with the packaged scanner, verify watch rescans, run bun run check in an isolated worktree, commit only this task's hunks of README.md and bun.lock.

Review-fix round (external cold reviews of HEAD cf8e7975):
10. Fix: readBlock read every block as a configuration scope, so if (false) { sourceSets.main.java.srcDirs = ['other'] } replaced the source directories silently, and in if (...) {} else {} only the else block was read. Declarations under control flow (if, else, when, switch, for, while, do, try, catch, finally) or inside a function (def, fun) now produce JAVA_GRADLE_UNRESOLVED and are not applied, in build and settings scripts, and every block of such a statement is read.
11. Fix: a source set selected by a name the scanner cannot read, such as sourceSets.named(name).java.srcDir 'extra', was silently ignored. A selector or block-call argument that is not a literal string now joins the path as an unreadable name, and a source directory declaration under one produces the warning without being applied; literal other source sets such as test stay silent.
12. Fix: allprojects declarations were reported but not applied, although Gradle applies them to the project whose script holds them. They now apply there and still produce a warning naming the other projects as needing a Gradle run; subprojects and project(':path') stay unresolved.
13. Regression fixture test/fixtures/java-gradle-scopes with a test in test-bun/java-gradle.test.ts; docs/scanners/java/index.md states the three rules.
Not in this task: Java source listing versus the scan (plugins/scanners/java/src/index.ts, owned by the TASK-413 lane).

14. Cold review of steps 10-13: a function is recognized by its shape, a name after the chain before the block (def f() {, void f() {, private fun f() {), which adds a function marker to the path instead of listing def and fun as control flow; all, configureEach, each and forEach blocks configure every source set, so a source directory under them is treated like one under an unreadable selector; configure(...) and project(...) with a non-literal argument count as configuration for other projects.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per plan. Correction during verification: included project directories that do not exist made checkReadiness fail (posix_spawn ENOENT from the missing cwd, reported as JAVA_RUNTIME_MISSING); gradleProjects now returns existing directories only. Reader split into settings and build readers after a real settings script (JUnit) put include(name) inside a function; settings projectDir/buildFileName assignments now produce the warning.

Verification:
- bun test test-bun/java-gradle.test.ts: Groovy multi-project (settings include incl. multi-line and ':libs:core', convention src/main/java with toolchain 17, replaced srcDirs with options.release 11 over VERSION_1_8, root without sources skipped, injected subprojects declaration reported); Kotlin (rootProject.name, languageVersion.set 21, added srcDir plus convention, non-literal include, projectDir, options.release and srcDir reported with their script names); watch patterns match build and settings scripts.
- Packaged scanner (bun plugins/scanners/java/build.ts; dist copy step still fails with the known EEXIST, worker.jar copied by hand): src/index.js imports only node builtins; THIRD-PARTY-NOTICES.txt lists good-enough-parser 1.1.23 (MIT), moo 0.5.2 (BSD-3-Clause), klona 2.0.6 (MIT), @thi.ng/zipper 1.0.3, @thi.ng/arrays 1.0.3, @thi.ng/api 7.2.0 (Apache-2.0). Offline harness (only git on PATH, fetch throws, two identical scans) over both Gradle fixtures plus java-maven: gradle-project and maven-project roots, expected files, 15 resolved calls, 4 JAVA_GRADLE_UNRESOLVED warnings.
- groma scan with PATH=/usr/bin:/bin (no Gradle) on a fixture repository created app, core and tool containers and printed the summarized Gradle warning; groma scan --watch rescanned after editing app/build.gradle (warnings x5 -> x6) and settings.gradle (x6 -> x7). groma scanner discover lists the Gradle build scripts with literal versions 17, 8 and 21.
- Real repositories (shallow clones in scratch): mockito selects 26 projects and scans exactly the 3 with Java main sources (494 files); RxJava declares sourceCompatibility VERSION_26 and fails as an unsupported language version (documented); JUnit uses custom build file names, now reported by the warning.
- Isolated worktree at 788c194b with only this task's changes (bun.lock limited to the good-enough-parser hunks): bun run check passed (Biome: only the existing iso-map warning; tsc; node 16 pass; bun 377 pass, 0 fail).

Open: AC #6 README row not changed because README.md carries another agent's uncommitted Swift row. bun.lock also carries that agent's Swift workspace hunks; commit only the good-enough-parser hunks.
Follow-ups (not in scope): the Java worker emits duplicate operation IDs for multi-variable field initializers (String A = ..., B = ...;), which fails createScanObservation for any Java build (reproduced with mockito and a one-file project); Gradle multi-project builds become one system per project, as Maven modules do; Gradle diagnostics are dropped when no Java project produces an observation.

Cold review fixes: joined the tokenizer's split '1.8' in versionParts (Groovy fixture now uses sourceCompatibility = 1.8); literal strings are read only from whole-element strings, bracketed lists and file/files/listOf/setOf calls, so srcDir(layout.buildDirectory.dir("...")), srcDir tasks.named('...') and include(*file("modules").list()) are unresolved and contribute no values; Gradle warnings now reach the report when no project produced evidence through a files-free observation (engine good-enough-parser, version from its package.json), verified by test and by groma scan on test/fixtures/java-gradle-unresolved (report line 'java · warning · JAVA_GRADLE_UNRESOLVED ×1: build.gradle:10: ...'); docs now say a replacing srcDirs keeps only its literal entries. Optional items applied: comments, projectDir warning text ('is not applied; the scan uses Gradle's default project directory and build script name'), maven.ts renamed to java-input.ts with the Gradle branch inlined, scripts renamed groovy, release default only in Main.java, adapter comment, CoreCheck.java under the test source set. The injected-configuration rule now applies to build scripts only, so settings project(':x').projectDir gets the not-applied text. Parse-once not done: the shared project scanner passes only a directory, noted in a comment.

Re-verification: bun test test-bun/java-gradle.test.ts 5 pass; packaged scanner offline over the Groovy, Kotlin and Maven fixtures (6 warnings, 15 resolved calls) and over the unresolved-only fixture (no roots or files, one warning); isolated worktree at 2674daee with only this task's changes (bun.lock and README.md limited to this task's hunks): bun run check passed (Biome: only the existing iso-map warning; tsc; node 16 pass; bun 383 pass, 0 fail). README row updated.

Review-fix round (external cold reviews of HEAD cf8e7975): readBlock read every block as a configuration scope, so if (false) { sourceSets.main.java.srcDirs = ['other'] } replaced the source directories silently, if (...) {} else {} read only its else block, and function bodies were applied. Declarations under control flow (if, else, when, switch, loops, try, catch, finally) and inside a function now produce JAVA_GRADLE_UNRESOLVED without being applied, in build and settings scripts, and every block of a statement is read. A selector or block-call argument that is not a literal string joins the path as an unreadable name, so sourceSets.named(name).java.srcDir 'extra' warns instead of being ignored; literal other source sets such as test stay silent. allprojects declarations now apply to the project whose script holds them and still warn for the other projects. Cold review of this fix: functions are recognized by shape (a name after the chain, as in private def f() {, void f() {, static def f() {, private fun f() {) through a function marker, and def and fun left the control-flow set; sourceSets.all, configureEach, each and forEach blocks share one unnamed-source-set predicate with the unreadable selector; configure(x) and project(x) with non-literal arguments now count as configuration for other projects; blockScope was extracted from readBlock to keep it under the complexity limit; the docs put the literal-values rule beside the first sentence and name all { }, configure(...) and project(...).
Verification: test-bun/java-gradle.test.ts adds test/fixtures/java-gradle-scopes (allprojects release 17 applied with its warning; if/else, a def function and named(sourceSetName) reported on lines 10, 12, 16 and 19 and not applied, so only src/main/java is scanned) and a table of nine scripts (four function forms, four every-source-set forms, configure(subprojects)); every case fails on the HEAD reader. The reviewer's 32 probe scripts behave as expected; real builds (junit, rxjava, mockito, commons-cli clones) keep their HEAD results except two new mockito warnings for the includes inside its if (ANDROID_HOME ...) block, which HEAD skipped silently. Isolated worktree at HEAD with only this task's changes: bun run check exit 0 (Biome: only existing warnings; tsc; node 16 pass; bun 557 pass, 35 env-gated skips, 0 fail).

Correction to the line above: the fourth build set named cli is the local fixture repository from the original verification, not a commons-cli clone.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-09-17 06:25
---
Coordination from TASK-431 (@codex): I am adding the Swift workspace entry to bun.lock and a separate Swift row to README.md. I have read your modified-file list and will preserve your Java dependency entries and README changes. No Java scanner files will be changed.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Java scanner now scans Gradle projects without running Gradle. Settings and build scripts (Groovy and Kotlin) are read with the bundled MIT-licensed good-enough-parser: literal includes select projects at Gradle's default directories, literal main source sets add to or replace src/main/java, and the Java version comes from options.release, sourceCompatibility or the toolchain. Declarations only a Gradle run could resolve produce JAVA_GRADLE_UNRESOLVED warnings with script and line, which reach the scan report even when no project produced evidence. Build and settings edits trigger watch rescans. The package bundles the parser and ships THIRD-PARTY-NOTICES.txt; discovery, the Java docs and the README describe Gradle support and its limits. Verified with test-bun/java-gradle.test.ts and three Gradle fixtures, offline packaged scans (only git on PATH, network disabled), groma scan and groma scan --watch runs, real repositories (mockito selects exactly its three Java projects), and bun run check in an isolated worktree.

Review-fix round: Gradle declarations the scanner cannot place on this project are now reported and never applied: those under control flow or inside a function, source directories for a source set it cannot name (a computed selector such as named(name), or every source set through all, configureEach, each or forEach), and configuration for other projects (subprojects, configure(...), project(...)). A literal allprojects declaration applies to the project that declares it and still warns for the others. Verified by the java-gradle-scopes fixture and a script table in test-bun/java-gradle.test.ts that fail on the previous reader, by real Gradle builds keeping their results, and by bun run check in an isolated worktree.
<!-- SECTION:FINAL_SUMMARY:END -->
