---
id: TASK-326.4
title: Deliver the official Java scanner using compiler and build tooling
status: In Progress
assignee:
  - '@codex-java'
created_date: '2026-09-08 21:34'
updated_date: '2026-09-08 22:35'
labels:
  - scanners
dependencies: []
references:
  - 'https://github.com/MrLesk/Groma.md/tree/research/java-scanner-prototype'
  - ../callforpapers
  - ../callforpapers/pom.xml
  - scan-lifecycle
  - read-read
documentation:
  - docs/scanners/evidence.md
  - docs/scanners/creating-a-plugin.md
modified_files:
  - plugins/scanners/java/java/md/groma/scanner/Declarations.java
  - plugins/scanners/java/java/md/groma/scanner/Json.java
  - plugins/scanners/java/java/md/groma/scanner/Main.java
  - plugins/scanners/java/java/md/groma/scanner/Uses.java
  - plugins/scanners/java/src/index.ts
  - plugins/scanners/java/.gitignore
  - plugins/scanners/java/package.json
  - plugins/scanners/java/java/md/groma/scanner/MavenModel.java
  - plugins/scanners/java/build.ts
  - plugins/scanners/java/src/process.ts
  - plugins/scanners/java/src/maven.ts
  - plugins/scanners/java/src/adapter.ts
  - test/fixtures/java-maven/src/main/java/Caller.java
  - test/fixtures/java-maven/src/main/java/Port.java
  - test/fixtures/java-maven/src/main/java/Provider.java
  - test/fixtures/java-maven/src/main/java/Shapes.java
  - test/fixtures/java-maven/src/main/java/Unused.java
  - test/fixtures/java-maven/pom.xml
  - test-bun/java-scanner.test.ts
  - plugins/scanners/java/smoke.ts
  - docs/scanners/java/index.md
  - docs/scanners/java/validation.md
  - src/viewers/source/structure.ts
  - test-bun/release-version.test.ts
  - bun.lock
  - .github/workflows/ci.yml
parent_task_id: TASK-326
type: feature
ordinal: 365000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer with the project's Java tooling installed can install the official Java scanner and scan one supported Maven project without manually assembling its dependency classpath. Start from research/java-scanner-prototype and reuse the compiler-backed worker, adapter, fixtures, packaging work, and real-project validation that fit these requirements. Do not restart the scanner or import the branch's conflicting Backlog records.

Use javac/compiler APIs for Java meaning and the project's build tooling for source roots, dependencies, and compilation configuration. The project JDK is a prerequisite; a bundled JDK is not required. Use ../callforpapers as the supported Maven acceptance project and a minimal independent fixture for automated behavior tests. Its declared JDK is currently Java 25; the research prototype's older language-level limits must not silently exclude this approved example. Reuse the branch's Maven/Petclinic findings as implementation evidence. Gradle and other build arrangements are not part of this first delivery. Framework declarations inform discovery/support reporting; they do not automatically create architecture relationships.

Supply the Java portion of the Java/Angular/embedded-TypeScript acceptance journey. The plugin can be implemented and verified through existing explicit scanner installation before guided discovery is completed. Identify the supported language/build versions, project preparation, and evidence limits. Reuse the established compiler analysis rather than growing custom Java language interpretation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Useful implementation and validation from research/java-scanner-prototype are reused, and Java semantics continue to come from established compiler APIs.
- [x] #2 The Maven project at ../callforpapers obtains its compilation inputs from project tooling and its declared installed JDK, currently Java 25, without requiring a user-maintained list of dependency JARs.
- [x] #3 Missing project tooling or dependencies produce concrete preparation instructions through the shared readiness flow, while unsupported build arrangements are identified clearly.
- [x] #4 The scanner returns deterministic shared-contract evidence with canonical targets and explicit uncertainty, without treating unresolved dispatch or framework declarations as proven collaborations.
- [x] #5 The packaged Java plugin runs in compiled Groma and contributes the Java evidence for ../callforpapers; its supported result is human-reviewed, repeat scans preserve curated architecture, and failure preserves the previous map.
- [ ] #6 Automated behavior tests use minimal independent fixtures; documented support and package checks include the Windows consumer execution path as well as the other declared platforms before release qualification.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the research javac worker and adapter; retain canonical compiler targets and conservative unresolved dispatch.
2. Replace manual configuration with the supported single-module Maven main-source model and dependency classpath, using the project wrapper/configuration and installed JDK 25. Keep generation as explicit preparation when needed.
3. Package portable Java bytecode plus bundled ESM without a bundled JDK; integrate the shared readiness hook once its owner establishes it.
4. Verify deterministic evidence and failures on independent Maven fixtures, then validate compiled package consumption, repeated ownership, failure preservation and actual callforpapers evidence in a temporary copy.
5. Document supported scope/platform qualification gaps and submit coordinator simplicity and acceptance reviews before finalization.

6. Requalify compiled export for the Java/TypeScript acceptance project: reuse the existing TypeScript worker path in the source-structure reader and extend the Java package smoke with a minimal TypeScript export witness.

7. Provision JDK 25 explicitly in the existing three-OS CI check jobs so the approved Java 25 fixture and Java 21 worker compilation use the required compiler.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reused the research Java compiler worker and semantic fixtures; replaced manual configuration/runtime bundle with Maven effective-model and compile-classpath export plus installed JDK. Maven wrapper 3.9.15/JDK 25.0.1 successfully prepared a task-owned callforpapers copy in 2m10s; no annotation processing or project compilation needed. Offline extraction returned 665 files, 6794 operations, 17760 calls. Focused compiler/Maven tests and compiled consumer smoke passed on macOS arm64; smoke preserved curated records through two scans and byte-identical previous architecture after failed attribution. Shared readiness integration is reserved for installation owner; internal checkJavaReadiness returns reusable input/tool paths or actionable errors. Windows launcher construction is tested, actual Windows/Linux execution remains release qualification work.

Source provenance: research worker commit a2ed086b14ed0754d9eb29dbe86f8d40702eaf48; callforpapers clean source commit 1cb6783f3379664e3f176e72c5419064ce24dbfd. Cold simplicity review passed with one accepted build simplification: compile worker once and copy the artifact for local use. The actual Maven classpath was 31580 bytes, so its transport moved from argv into existing stdin to support Windows command limits; a full callforpapers rerun matched all prior evidence exactly. Focused rerun: 4 tests, 19 assertions passed; compiled fixture consumer passed; Biome and typecheck passed. Targeted transport/build re-review and exclusive repository check are pending coordinator scheduling.

Implementer specification review: AC1 proven by selective research reuse and compiler-backed fixture checks; AC2 proven by clean callforpapers commit 1cb6783f3379664e3f176e72c5419064ce24dbfd scanned via its wrapper/JDK25 without manual JARs; AC4 proven by deterministic fixture and actual-project equality, exact overload targets, unresolved virtual dispatch, and no callback-binding claims. AC3 shared readiness presentation remains integration work, while checkJavaReadiness supplies actionable reusable project/tooling input checks. AC5 awaits coordinator map review; package installation, curated repeat scans and failed-scan preservation passed. AC6 includes the reusable Windows/Linux/macOS smoke path and Windows command construction, with actual non-macOS execution held for release qualification. Quality review found no remaining defect in the declared supported flow, no new domain concept or custom Java resolver, and all changed functions pass focused lint/type checks. Targeted cold re-review passed after build/transport simplification. The coordinator-requested first-wave bun run check will cover this unchanged patch; no duplicate suite launched.

Coordinator reproduced export ENOENT /$bunfs/package.json. Reproduction confirmed that compiled Java+TypeScript scan succeeds; export subsequently failed in src/viewers/source/structure.ts because its independent TypeScript API client omitted the bundled worker path. worker.ts and source-analysis.ts are correct and unchanged. With coordinator file lease, the reader now reuses typescriptWorkerPath. Extended package smoke copies the existing independent one-function TypeScript fixture and checks exported parsed Code details. The extended smoke fails against the prior binary with the exact reported error; fixed-binary and actual-project verification are running. Earlier scan evidence remains valid, but it did not establish exported Code-details behavior.

Targeted specification review: the reproduced user action is compiled export of the supported Java+TypeScript repository; it must include TypeScript Code details using the packaged worker. The old compiled binary fails the added one-function export smoke; the fixed binary passes the same witness and existing curated-rescan/failure checks. Six focused source-reader tests pass, with lint/typecheck clean. Targeted quality review: one existing helper is reused at the second API construction site; source execution still delegates to the installed TypeScript package, compiled execution now uses the same worker as scanning. No extra runtime abstraction, fallback, build change or evidence semantic change was added. Actual full-project export remains running. Full repository recheck awaits coordinator scheduling while Angular source is active.

Fixed actual acceptance commands passed: /tmp/groma-java-export-fixed scan and export /tmp/groma-java-review-export-fixed from the retained task copy. Scan created 0 and refreshed 1195 components. Export materialized 1200 elements, 451 parsed TypeScript source files and 1195 source reads. Actual export snapshot and logs are retained at /tmp/groma-java-review-export-fixed/snapshot.js, /tmp/groma-java-fixed-scan.log and /tmp/groma-java-fixed-export.log. Documentation now distinguishes the initial valid scan from the previously unproved export path.

Coordinator map acceptance passed on /tmp/groma-java-review-export-fixed: opened the cfp system, searched CompanyResource, selected the observed component and How built, and verified src/main/java/com/devoxx/cfp/web/rest/entity/CompanyResource.java with 269 lines and Java provenance under the 665-source Java container. The separate initial Cfpdev TypeScript system is existing uncurated scope behavior; no invented Spring or HTTP interaction was accepted. Combined curated Angular company-merge work remains TASK-326.9/TASK-326.3. Targeted final review of the source-reader worker reuse and old-fail/new-pass export regression passed. AC5 is now verified alongside compiled installation, repeated curated ownership and failure preservation. Remaining acceptance: AC3 has actionable internal checkJavaReadiness but is not yet exercised through the shared readiness flow owned by TASK-326.3. AC6 has independent fixtures, documented platform scope, reusable compiled consumer smoke and Windows command-construction coverage; actual Windows/Linux consumer execution is still unverified and reserved for TASK-326.7, so AC6 remains conservatively unchecked pending coordinator release-gate interpretation. The shared repository check is pending the stable Angular checkpoint. No code changed during this update; task remains In Progress.

Shared-check regression fixed in the leased release-version fixture-copy setup. Its isolated checkout copied src/ but not the new source-reader dependency plugins/scanners/typescript/src/worker.ts; adding exactly that file to the existing copy list restores compilation. No assertion, timeout, isolation or production behavior changed. bun test test-bun/release-version.test.ts passed (1 test, 2.45s); focused Biome passed. The test still deletes the build checkout and verifies the prepared version from the standalone binary afterward. Full suite remains coordinator-scheduled.

The coordinated repository check after the isolated release-fixture correction passed: Node suite passes; Bun 382 pass, 1 Java tooling integration skip, 0 fail, 782 assertions. Log: /tmp/groma-angular-shared-check-after-java-fixture.log. Coordinator browser acceptance and targeted source-reader review have passed. Guided installation TASK-326.3 is now active on these technical prerequisites; shared readiness presentation remains its responsibility.

Coordinator confirms TASK-326.3 shared readiness integration: compiled CLI reports Java ready on the prepared acceptance copy, followed by a successful scan preserving all curated Markdown. The latest coordinated repository check passes: Node 110; Bun 386 passed, 1 tooling integration skip, 0 failed. All implementation, targeted, full-context and map reviews passed. AC3 is verified; AC6 remains unchecked because actual Windows/Linux consumer execution remains release qualification work. Task remains In Progress. Coordinator assigned the two Java-only bun.lock workspace/package entries to this task and authorized committing/pushing the verified implementation. The Java entrypoint will be staged at its pre-installation baseline; TASK-326.3 readiness wiring remains in the working file for its own commit.

CI run 34286237315 on e310872 failed only the Java compiler prerequisites: Linux/Windows selected JDK17 and could not compile --release21; macOS could not analyze --release25. With coordinator lease, .github/workflows/ci.yml now adds actions/setup-java@v6 with distribution temurin and java-version 25 before existing dependency/check steps. Official action README documents this exact configuration and that it sets JAVA_HOME/PATH (https://github.com/actions/setup-java). YAML parsed successfully; removing the added setup step makes the parsed workflow exactly equal to HEAD, proving matrix, fail-fast, checks and assertions are unchanged. Focused Java checks with explicit local JDK25 and actual Maven integration passed: 4 tests, 19 assertions, 0 failures. git diff --check passed. No tests skipped or weakened, no release-workflow changes, no full suite/commit/push performed; coordinator will schedule requalification.
<!-- SECTION:NOTES:END -->
