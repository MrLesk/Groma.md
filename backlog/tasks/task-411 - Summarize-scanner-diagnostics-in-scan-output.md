---
id: TASK-411
title: Summarize scanner diagnostics in scan output
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-18 23:09'
labels: []
dependencies: []
references:
  - src-scanner
  - java-src-index
modified_files:
  - src/scanner.ts
  - plugins/scanners/java/java/md/groma/scanner/Main.java
  - plugins/scanners/java/java/md/groma/scanner/MissingTypes.java
  - test-bun/java-scanner.test.ts
  - test-bun/scanner-composition.test.ts
  - docs/scanners/index.md
  - docs/scanners/java/index.md
  - docs/scanners/fresh-checkout-validation.md
  - plugins/scanners/java/src/missing-types.ts
  - plugins/scanners/java/src/index.ts
  - test/fixtures/java-missing-types/one/pom.xml
  - test/fixtures/java-missing-types/one/src/main/java/one/Reader.java
  - test/fixtures/java-missing-types/two/pom.xml
  - test/fixtures/java-missing-types/two/src/main/java/two/Writer.java
type: enhancement
ordinal: 466000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On callforpapers, `groma scan` printed 29,970 lines, so the two-line summary and any real problem were lost. The Java worker forwards every javac attribution error as a warning (`plugins/scanners/java/java/md/groma/scanner/Main.java`). About 11,000 of these are "cannot find symbol" or "package does not exist" messages that exist only because project dependencies are intentionally not loaded. The scan report then prints every scanner diagnostic on its own line (`src/scanner.ts`), and the Angular scanner adds 921 unsupported-binding notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The `groma scan` report prints the summary and at most one line per scanner and diagnostic code, with its occurrence count and one example location.
- [x] #2 Java reports missing external types from absent project dependencies as one diagnostic with the count and the most frequently missing packages.
- [x] #3 Scanner failures and syntax errors that fail a scan remain individually visible.
- [x] #4 Scanner documentation describes the summarized report.
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
1. Baseline: clone callforpapers into a task-specific temp dir, copy its groma/ config, run bun src/cli.ts scan and count report lines (29,970).
2. src/scanner.ts: formatScanReport groups scanner diagnostics by scanner ID and code and prints one line per group with severity, diagnostic count (×N), and the first listed diagnostic's location and first message line as the example. Scanner failures stay printed in full, unchanged.
3. Replaced in the review-fix round (see step 7): the Java worker labels each javac unresolved-symbol error (compiler.err.cant.resolve*) and missing-package error (compiler.err.doesnt.exist) JAVA_MISSING_EXTERNAL_TYPES, and the Java plugin folds every project's labels into one info diagnostic JAVA_MISSING_EXTERNAL_TYPES with the reference count, the first listed location, and the five most frequently missing packages (parsed from the Locale.ROOT 'package X does not exist' text). Other javac attribution errors stay individual warnings; syntax errors still fail the scan with every error listed. (Originally a worker-side MissingTypes.java summarized each project separately.)
4. Tests: extend the missing-external-type case in test-bun/java-scanner.test.ts to assert the single summary diagnostic; add a scan-report test in test-bun/scanner-composition.test.ts asserting one line per scanner and code with count and first example while failures stay separate.
5. Docs: docs/scanners/index.md (summarized report), docs/scanners/java/index.md (missing external types diagnostic and its honest cause), docs/scanners/fresh-checkout-validation.md wording.
6. Rebuild the Java worker with bun plugins/scanners/java/build.ts, rerun the clone scan, compare line counts, run bun run check in an isolated worktree.

Review-fix round (external reviews of cf8e7975):
7. Fix: a repository with several Java projects runs one worker per project, and each worker emitted its own JAVA_MISSING_EXTERNAL_TYPES summary, so the report showed ×N and kept only the first project's count and packages (contradicting AC #2 and docs/scanners/java/index.md, which say the count is 1). The worker now labels each unresolved-name error JAVA_MISSING_EXTERNAL_TYPES (info, javac's own message) and MissingTypes.java is deleted; the Java plugin folds every project's labels into the one summary after combining projects (plugins/scanners/java/src/missing-types.ts), choosing the five most frequent packages after aggregation. Each project keeps its own compiler run.
8. Regression test: a two-project Maven fixture scanned through the built Java package yields one summary whose count and packages cover both projects; the worker-level test asserts the per-error labels.

9. Simplicity round: the worker emits every javac diagnostic with its own code, and missing-types.ts alone decides which codes are unresolved names and folds them into the summary (one language owns the rule). A unit test of summarizeMissingTypes on a synthetic two-project observation replaces the package-building test and its fixture; the worker test checks that its raw codes fold into one summary.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: src/scanner.ts formatScanReport groups scanner diagnostics by scanner ID and code (first-seen order) and prints one line with severity, ×count, and the first occurrence's file:line plus the first line of its message. Java worker: new MissingTypes.java absorbs javac compiler.err.cant.resolve* and compiler.err.doesnt.exist into one info diagnostic JAVA_MISSING_EXTERNAL_TYPES (javac occurrence count, first location, five most frequent packages from 'package X does not exist'); Main.java shares a message() helper. Other javac attribution errors stay individual warnings in the observation.

Verification:
- callforpapers clone (scratchpad, groma/ copied from the original, original untouched): before 29,970 report lines; after 1,275. Scanner diagnostic lines went from ~28,350 to 11 (angular 1, java 9, php 1). Java line: 11235 unresolved references; packages org.slf4j, org.springframework.data.domain, jakarta.validation.constraints, org.springframework.http, org.springframework.stereotype. The javac count (11235) is higher than the old 11120 printed lines because parseScanObservation dedupes identical diagnostics on one line. Remaining lines are 65 evidence conflicts and ~1,197 architecture-finding lines (290 findings), which are not scanner diagnostics.
- Syntax error end to end on the clone: appended invalid Java; the report printed the JAVA_SOURCE_INVALID failure with each compiler.err.illegal.start.of.expr error on its own line (file restored afterwards). Worker run directly also exits 2 and lists every syntax error.
- Tests: test-bun/java-scanner.test.ts asserts one JAVA_MISSING_EXTERNAL_TYPES diagnostic (count 3, package unavailable) and no remaining compiler.err missing-type diagnostics; test-bun/scanner-composition.test.ts asserts one line per scanner and code with count and first example while two failures stay separate.
- bun run check: first run failed only in test-bun/inspect-details.test.ts typecheck (another agent's in-progress TASK-419 change); rerun passed (Biome, tsc, node 16 pass, bun 368 pass).
- Java plugin rebuilt with bun plugins/scanners/java/build.ts. plugins/scanners/java/dist is gitignored (not tracked), so no dist files are part of the change. The build script's final copy into plugins/scanners/java/dist failed with EEXIST on existing jlink legal symlinks (pre-existing build issue); dist/package was complete, runtimes were identical, and dist/worker.jar was copied from dist/package/dist/worker.jar.

Cold review (no required fixes) applied: MissingTypes owns the finished diagnostic (private example, diagnostic(root) returns it or null; Main.message is package-private), Javadoc states why severity is info and that javac counts every unresolved name including typos (also in docs/scanners/java/index.md), message now reads '... are unresolved (project dependencies and generated sources are not loaded)', package regex runs only for compiler.err.doesnt.exist with a Locale.ROOT comment, 'first listed diagnostic' wording in src/scanner.ts and docs, grouped map uses { first, count }, docs call ×N the diagnostic count, report test asserts group lines by file and count without glyphs and passes crypto.randomUUID() as root, Java test title corrected and package assertion loosened.

Re-verification: focused tests pass (9 pass). Java worker rebuilt (build script again stops at its final copy with the pre-existing EEXIST on jlink legal symlinks; dist/package complete, runtime identical, worker.jar synced). Clone rescan: still 1,275 lines, Java summary line shows the new wording with 11235 references. Isolated worktree at HEAD 37a8a7c1 plus only this task's diff: bun run check passed (Biome, tsc, node 16 pass, bun 361 pass, 0 fail); worktree removed and pruned.

Non-blocking follow-ups: plugins/scanners/java/build.ts fails copying into an existing plugin dist (EEXIST on symlinks); architecture findings (~1,197 lines) and evidence conflicts (65 lines) still dominate the sample report and are outside this task (findings owned by TASK-423).

Non-blocking follow-up (predates this task, from TASK-326.4 in 14181be7): the Uses.java per-project summaries JAVA_UNRESOLVED_CALLS and JAVA_METHOD_REFERENCES have the same multi-project shape. Identical per-project messages collapse in createScanObservation (two projects with one unresolved call each report '1 calls'), and different counts would show ×2 with only the first message. Folding them the way summarizeMissingTypes folds missing types would fix it.

Count nuance: createScanObservation keeps one of several diagnostics identical in message, file and line, so identical javac unresolved-name errors on one line count once in the folded JAVA_MISSING_EXTERNAL_TYPES count. docs/scanners/java/index.md keeps 'number of unresolved references' (coordinator decision: accurate enough).

Review-fix round (external reviews of cf8e7975).
Fixed: each Java project's worker emitted its own JAVA_MISSING_EXTERNAL_TYPES summary, so a repository with several Java projects reported ×N and kept only the first project's count and packages (Codex, AC #2). Main.java now labels each compiler.err.cant.resolve* and compiler.err.doesnt.exist error JAVA_MISSING_EXTERNAL_TYPES (info, javac's Locale.ROOT message); MissingTypes.java is deleted and Main.message is private again. plugins/scanners/java/src/missing-types.ts (summarizeMissingTypes) runs in the plugin's repository scan after projects are combined and emits one summary: the count, the first listed diagnostic (observation sort order) as the example, and the five most frequent packages across all projects. Each project keeps its own compiler run. src/scanner.ts needed no change.
Tests: test/fixtures/java-missing-types holds two Maven projects; "Java folds missing external types from every project into one summary" (test-bun/java-scanner.test.ts) builds the package and scans it: one summary starting '6 ' with 'packages: beta, alpha.'. At cf8e7975 it receives 2 diagnostics. The worker-level test now expects 3 labeled diagnostics and no compiler.err codes.
End to end: groma scan with the built package on the fixture printed one line, JAVA_MISSING_EXTERNAL_TYPES ×1 with 6 references and packages beta, alpha.
Cold review applied: plan step 3 and the final summary describe the plugin-side fold; the doc comment says first listed diagnostic; summarizeMissingTypes returns early for an undefined observation.
Verification: isolated worktree at 83cc22fa with only this change, bun run check exit 0 (biome 1 warning and 2 infos in untouched files, tsc clean, node 16 pass, bun 525 pass 35 skip 0 fail).
Live rescans: plugins/scanners/java/dist/worker.jar is gitignored and still holds the previous worker, whose per-project summaries the new fold would count as single unresolved names; rebuild it with bun plugins/scanners/java/build.ts before any live rescan of this repository or a sample.

Simplicity round (cold junior-maintainer review of the fix round).
One language owns the rule: the worker (Main.java) reports every javac diagnostic under its own code again, and missing-types.ts decides which codes are unresolved names (compiler.err.doesnt.exist and compiler.err.cant.resolve*) and folds them from every project into the JAVA_MISSING_EXTERNAL_TYPES info summary; other compiler errors stay warnings with their javac code.
Tests: a unit test of summarizeMissingTypes on a synthetic two-project observation (five unresolved names, packages beta then alpha, one other compiler error kept) replaces the package-building test and its test/fixtures/java-missing-types fixture; the worker test now checks that the worker's raw codes fold into one summary of 3 references.
Verification: isolated worktree at 6c9ec88b with only this change, bun run check exit 0 (biome 1 warning and 2 infos in untouched files, tsc clean, node 16 pass, bun 593 pass 35 skip 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma scan now prints one line per scanner and diagnostic code (severity, ×N diagnostic count, first listed diagnostic as example) instead of every diagnostic, and the Java plugin folds the javac 'cannot find symbol' and 'package does not exist' errors of every Java project into one JAVA_MISSING_EXTERNAL_TYPES info diagnostic with the reference count, an example location and the five most frequently missing packages. Scanner failures, including every Java syntax error, are still printed in full. Scanner docs describe the summarized report. On the callforpapers sample the report dropped from 29,970 to 1,275 lines (scanner diagnostic lines from about 28,350 to 11). Verified with new assertions in test-bun/java-scanner.test.ts and test-bun/scanner-composition.test.ts, an end-to-end syntax-error scan on the sample clone, and bun run check in an isolated worktree.

Review-fix round: a repository with several Java projects showed one JAVA_MISSING_EXTERNAL_TYPES summary per project, and the report kept only the first project's count and packages. The worker now labels each unresolved-name error and the Java plugin folds every project's labels into one summary, ranking packages across all projects; a two-project fixture test fails at cf8e7975 (2 diagnostics) and passes now (one summary, 6 references, packages beta then alpha), and an isolated bun run check exits 0.

Simplicity round: the worker now reports raw javac codes and missing-types.ts alone classifies and folds unresolved names, tested by a fast unit test instead of a package build.
<!-- SECTION:FINAL_SUMMARY:END -->
