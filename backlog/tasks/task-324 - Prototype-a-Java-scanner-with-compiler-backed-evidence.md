---
id: TASK-324
title: Prototype a Java scanner with compiler-backed evidence
status: In Progress
assignee:
  - '@java-scanner'
created_date: '2026-09-07 21:59'
updated_date: '2026-09-07 22:40'
labels: []
dependencies: []
references:
  - scanner
  - scanner-build
  - scanner-index
modified_files:
  - .github/workflows/java-research-workspace.yml
  - features/java-scanner.feature
  - plugins/scanners/java/package.json
  - plugins/scanners/java/.gitignore
  - plugins/scanners/java/src/config.ts
  - plugins/scanners/java/src/adapter.ts
  - plugins/scanners/java/src/index.ts
  - plugins/scanners/java/java/md/groma/scanner/Json.java
  - plugins/scanners/java/java/md/groma/scanner/Main.java
  - plugins/scanners/java/java/md/groma/scanner/Declarations.java
  - plugins/scanners/java/java/md/groma/scanner/Uses.java
  - plugins/scanners/java/build.ts
  - bun.lock
  - test/fixtures/java-source-set/groma-java.json
  - test/fixtures/java-source-set/src/Provider.java
  - test/fixtures/java-source-set/src/Port.java
  - test/fixtures/java-source-set/src/Unused.java
  - test/fixtures/java-source-set/src/Caller.java
  - test/fixtures/java-source-set/src/Shapes.java
  - test-bun/java-scanner.test.ts
  - .github/workflows/ci.yml
  - scripts/smoke-java-scanner.ts
  - .github/workflows/java-research-dependencies.yml
  - groma/systems/groma/containers/scanner/components/adapter.md
  - groma/systems/groma/containers/scanner/components/config.md
  - groma/systems/groma/containers/scanner/components/scanner-build.md
  - groma/systems/groma/containers/scanner/components/scanner-index.md
  - groma/systems/groma/containers/scanner/components/smoke-java-scanner.md
  - docs/scanners/java/index.md
  - docs/scanners/java/research.md
  - docs/scanners/index.md
  - CONTRIBUTING.md
  - docs/scanners/java/validation.md
  - .github/java-research.patch.b64
  - .github/workflows/java-research-publish.yml
  - .github/java-research-finalize.patch
ordinal: 361000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Research the Groma scanner contract and Java project support; implement an opt-in Java prototype with compiler-backed source evidence, documented installation and support limits, tests, and a real-repository experiment. Review on research/java-scanner-prototype; do not change the C# scanner.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Document scanner contract, Java relationship semantics, project scope, installation and production gates with primary references.
- [x] #2 Provide a Java compiler-backed scanner prototype through the existing Groma plugin contract without inferring runtime dispatch from declarations.
- [x] #3 Verify focused fixtures and a pinned public Java repository; report exact commands, results, and unsupported cases.
- [x] #4 Run the repository check and compiled delivery smoke test, documenting any failures honestly.
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
1. Review the scanner exchange, core inference, installation, C4/OKF and contribution contracts.
2. Add an opt-in Java plugin using the public JDK compiler API with one explicit compilation source set, no build or annotation-processor execution, and atomic failure. Preserve unresolved dispatch and keep source references temporary.
3. Stage a prebuilt ESM/JAR package and an optional platform runtime image so the installed global Groma binary needs no Node, Bun, Maven or external JDK to scan. Do not publish packages.
4. Verify language fixtures, existing core abstention, cloned Commons Lang and Petclinic source snapshots, and package/source/compiled parity. Run bun run check and build.
5. Document production support gates, project-model adapters, installation, scale limits and exact experiment results. Update architecture through Groma and push only the Java task files on the review branch.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Specification review: all four prototype ACs have objective evidence in docs/scanners/java/validation.md. Quality review: exact compiler elements preserve overloads/wrappers; unresolved virtual/external targets never become bindings; no shared inference/schema/C# changes. Corrected runtime license symlinks before offline npm packing; all 152 runtime files survive the tarball. Full check: 110 Node and 365 Bun tests, 10 Java conformance tests; six pre-existing lint warnings. Compiled Groma + extracted platform npm tarball passes with Git-only PATH, full source/package equality, repeat-scan idempotence and atomic failed-scan preservation. Commons Lang 264 files/5602 operations/10859 calls and Petclinic 30/103/243 match raw worker, source adapter and packaged observations. Recorded 120-second combined-command watchdog interruption and successful isolated existing web-smoke retry without changing that test. Separate-agent cold simplicity/full-context reviews are unavailable here and remain for review; status stays In Progress rather than Done. Java 25, automatic Maven/Gradle models, callback/DI dispatch, incremental scale, platform certification and public package release remain explicitly unsupported.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the opt-in javac source-set prototype and prebuilt/bundled-runtime delivery; verified compiler semantics, two pinned Java repositories, the full repository check, and standalone Groma using the extracted npm package. Research, installation, production gates and exact results are documented. Ready for branch review, not production release; independent simplicity/complexity reviews remain outstanding.
<!-- SECTION:FINAL_SUMMARY:END -->
