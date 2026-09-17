---
id: TASK-411
title: Summarize scanner diagnostics in scan output
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-17 06:11'
labels: []
dependencies: []
references:
  - src-scanner
modified_files:
  - src/scanner.ts
  - plugins/scanners/java/java/md/groma/scanner/Main.java
  - plugins/scanners/java/java/md/groma/scanner/MissingTypes.java
  - test-bun/java-scanner.test.ts
  - test-bun/scanner-composition.test.ts
  - docs/scanners/index.md
  - docs/scanners/java/index.md
  - docs/scanners/fresh-checkout-validation.md
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
3. Java worker: new MissingTypes.java absorbs javac unresolved-symbol errors (compiler.err.cant.resolve*) and missing-package errors (compiler.err.doesnt.exist) and returns one info diagnostic JAVA_MISSING_EXTERNAL_TYPES with the reference count, the first location, and the five most frequently missing packages (parsed from the Locale.ROOT 'package X does not exist' text). Main.java appends it; other javac attribution errors stay individual warnings; syntax errors still fail the scan with every error listed.
4. Tests: extend the missing-external-type case in test-bun/java-scanner.test.ts to assert the single summary diagnostic; add a scan-report test in test-bun/scanner-composition.test.ts asserting one line per scanner and code with count and first example while failures stay separate.
5. Docs: docs/scanners/index.md (summarized report), docs/scanners/java/index.md (missing external types diagnostic and its honest cause), docs/scanners/fresh-checkout-validation.md wording.
6. Rebuild the Java worker with bun plugins/scanners/java/build.ts, rerun the clone scan, compare line counts, run bun run check in an isolated worktree.
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
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma scan now prints one line per scanner and diagnostic code (severity, ×N diagnostic count, first listed diagnostic as example) instead of every diagnostic, and the Java worker folds javac 'cannot find symbol' and 'package does not exist' errors into one JAVA_MISSING_EXTERNAL_TYPES info diagnostic with the reference count, an example location and the five most frequently missing packages. Scanner failures, including every Java syntax error, are still printed in full. Scanner docs describe the summarized report. On the callforpapers sample the report dropped from 29,970 to 1,275 lines (scanner diagnostic lines from about 28,350 to 11). Verified with new assertions in test-bun/java-scanner.test.ts and test-bun/scanner-composition.test.ts, an end-to-end syntax-error scan on the sample clone, and bun run check in an isolated worktree.
<!-- SECTION:FINAL_SUMMARY:END -->
