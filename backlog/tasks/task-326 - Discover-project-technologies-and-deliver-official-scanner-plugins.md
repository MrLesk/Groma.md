---
id: TASK-326
title: Discover project technologies and deliver official scanner plugins
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-08 21:32'
updated_date: '2026-09-09 13:20'
labels:
  - scanners
dependencies: []
references:
  - TASK-228
  - TASK-322
  - ../callforpapers
  - TASK-326.8
  - TASK-326.9
  - TASK-326.10
  - TASK-326.11
documentation:
  - docs/scanners/index.md
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/evidence.md
  - docs/component-markdown.md
priority: high
type: feature
ordinal: 361000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers opening a repository with multiple languages, frameworks, and nested applications can discover the supported technologies, review the best compatible set of official scanner plugins, install their selection, resolve missing tooling, and reach a useful first architecture map. Discovery reports its evidence and coverage limits; it does not promise to identify every possible technology.

Deliver the official C#, Java, Go, Rust, Angular, Vue, and React scanners alongside the embedded TypeScript scanner. Angular is a new separately installable framework scanner. Start from the existing research branches and reuse suitable implementation, fixtures, packaging, and validation evidence rather than restarting from scratch: research/csharp-scanner-prototype, research/java-scanner-prototype, research/go-scanner-prototype, research/rust-scanner-prototype, and research/rust-codex-validation. Review that work against these requirements; a research result is not release qualification. Keep each branch's conflicting Backlog records out of implementation integration and use this task hierarchy for delivery tracking.

All scanners rely on existing compilers, language SDKs, semantic analyzers, and project tools for language understanding. Consumers provide the project's required tools on their developer machine or CI environment. Plugins own ecosystem integration and Groma-specific evidence extraction; core owns common evidence semantics, curated architecture ownership, and relationship inference. Do not build custom replacements for language name or type resolution, a universal toolchain installer, or bundled development environments solely for toolchain-free portability.

Discovery and plugin selection are operational configuration, not new C4 elements or OKF architecture records. Compiler projects and framework dependencies are evidence, not automatic component boundaries. Architecture remains readable ordinary Markdown with links, interpreted by the existing Groma application profile. Angular is a separate plugin using the existing scanner lifecycle. It carries its own compatible TypeScript tooling while Groma keeps its embedded TypeScript 7.1 SDK. Both may inspect the same files: core preserves one curated source owner, combines complementary evidence, and reports contradictory claims without deriving relationships from disputed evidence. Compiler-internal IDs are not shared source identity, and no blanket scanner-priority rule selects a winner.

Use ../callforpapers as the concrete Java/Angular acceptance project with three enabled scanners: Java, Angular, and embedded TypeScript. Review one small company-merge flow before extending framework behavior. Use minimal independent fixtures under test/fixtures for automated checks, including one complementary binding and one deliberately contradictory claim from overlapping scanners. The Angular package's own compiler dependencies are required for framework compatibility, not toolchain-free portability. Java support must cover the project's declared JDK, currently Java 25. C#, Go, and Rust each retain one supported example and human review. Reuse existing installation, scanner configuration, reconciliation, and viewer lifecycles. The child tasks capture delivery outcomes, not a speculative implementation design.

Vue and React follow the same separately installable, compiler-backed framework-plugin approach as Angular. Each starts with one reviewed concrete interaction and one independent fixture, preserves the embedded TypeScript SDK, and uses existing evidence composition and architecture ownership. Their implementation tasks are TASK-326.10 and TASK-326.11; discovery and release qualification include both after their technical gates pass.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A project with multiple languages and nested applications produces an evidence-backed proposal covering all supported technologies found within the documented discovery scope; unsupported or uncertain discoveries remain visible.
- [ ] #2 Users can review and adjust official plugin recommendations, install the selected exact versions, and receive actionable project-tooling readiness results; the same journey has a non-interactive CI path.
- [ ] #3 Official C#, Java, Go, and Rust scanners reuse the existing research work; a separate Angular plugin carries compatible TypeScript tooling alongside Groma's embedded TypeScript 7.1 SDK. All use established analysis tools and the shared evidence contract.
- [ ] #4 ../callforpapers reaches a human-reviewed useful map with Java, Angular, and embedded TypeScript enabled; overlapping source evidence preserves one curated owner, complementary evidence is retained, and contradictory claims are reported without deriving a disputed relationship. An enabled scanner failure preserves the previous architecture.
- [ ] #5 Users can rerun discovery as the project changes and distinguish installed support, recommended additions, and remaining coverage limits.
- [ ] #6 Published artifacts pass the supported consumer journey on their declared Groma operating-system and CPU targets with documented language tools installed.
- [x] #7 Separate Vue and React scanners each pass one reviewed framework interaction, shared-source ownership, rescan/failure preservation, and a packed-artifact compiled-consumer journey using established analysis tooling.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Coordinate TASK-326.1, TASK-326.2, TASK-326.4, and TASK-326.8 as independent first-wave work with one fresh GPT-6 Astra medium implementer per task and exclusive file ownership.
2. Gate shared SDK, dependency manifests/lockfiles, and common documentation edits to prevent file-level collisions in main. Preserve existing research work and task traceability.
3. Run task-focused verification, one cold simplicity review where required, the implementer's specification/quality review, and a separate full-context complexity review. Record human-review and material-choice gates honestly.
4. Dispatch Angular after its prerequisites, guided installation after discovery/Java/Angular, Go and Rust after installation, and release preparation after all required implementations, subject to Alex's decision on technical dependency readiness.
5. Prepare the callforpapers acceptance evidence and supported-platform release evidence. Hold public publication and unresolved human/design approvals for Alex; never claim checks or reviews that did not run.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Alex explicitly authorized the coordinator to perform the required acceptance/map reviews on his behalf. Prerequisite work may unblock dependent implementation after objective checks and required agent reviews pass. Record coordinator review evidence rather than claiming Alex personally reviewed it. This delegation does not by itself authorize public publication or new material product/CI/support decisions outside the approved tasks.

Baseline before implementation: bun run check passed on main, including TypeScript checks, the Node suite, and 355 Bun tests. Biome reported six existing complexity warnings outside the current task areas. First-wave implementers are discovery (326.1), C# (326.2), Java (326.4), and shared-source composition (326.8), all fresh-context GPT-6 Astra medium. File ownership is partitioned; root dependency/build files and CI require coordinator allocation before writes.

Alex explicitly authorized installing any SDK or tool needed to implement these tasks. Use task-local installations where practical, record tool versions and material side effects, and preserve target application source/dependency settings. This is implementation/test environment permission, not a requirement to ship SDK installers in Groma.

First-wave shared check passed: Node 110, Bun 379 with one Java tooling integration skip separately exercised by Java validation. TASK-326.8 completed cold, own, and full-context reviews, was accepted by coordinator, and committed/pushed as 7abf3cc. Discovery technical review passes but AC4 remains open for verified published Java/Angular recommendations. C# full-context review and coordinator browser map acceptance pass; its scoped finalization is underway. Angular implementation started after composition/Java technical prerequisites; compatible compiler dependencies remain local to its package. Coordinator reproduced a compiled embedded-TypeScript startup failure while exporting the Java acceptance project; Java implementer is investigating before combined-project acceptance. No public release or expanded platform claim has been made.

TASK-326.2 is Done and pushed as ffe46a94a07b656578af8007aeef4b249ecc45f5; CI passed on macOS, Linux and Windows at that head (including committed TASK-326.8). TASK-326.9 passed cold/own/full-context reviews and coordinator browser review of the curated company-merge TS+HTML responsibilities and callback relationship; scoped commit is underway. Latest shared check passes Node suite and Bun 382/1 skip/0 fail after correcting the isolated source-reader build fixture. Actual Java+Angular+TypeScript repeat and failed scans preserve all 1394 curated acceptance Markdown files. TASK-326.3 guided installation started on the verified technical prerequisites. Alex separately authorized TASK-327 to fix the independently reproduced pre-existing web authoring/reload race; it remains separate from scanner implementation.

Alex requested Vue and React scanners on 2026-09-09 using the same approach. Created TASK-326.10 and TASK-326.11 and dispatched independent fresh GPT-6 Astra medium workers with isolated plugin/test/doc paths. Shared file edits remain coordinated. Previous public naming, native packaging, CI structure, publication, and separate Windows investigation decisions are not inferred as approved by this additional scanner request.

Vue and React technical delivery is complete: TASK-326.10 committed as 2ee5efb and TASK-326.11 as 12e3669. Both actual npm-packed compiled consumers passed on independent fixtures and pinned real projects (Vue REPL and Backlog); coordinator browser reviews confirmed callback direction, curated responsibilities and authored relationships. Source edits, repeat scans, overlap/conflicts and enabled-scan failure preservation passed. Both cold and full-context reviews plus implementer specification/quality reviews passed. Shared bun run check passed (Node 110, Bun 398, seven tooling-dependent skips, zero failures; six existing complexity warnings), log /tmp/groma-vue-react-check.log. Discovery extension is committed as 80a28a7. Stable local release validation helper and five-scanner proof scripts are committed as 3dbe68a, with TASK-326.7 still In Progress. Public names, native package layout, CI topology, separate Windows watcher investigation and publication remain pending the existing user decisions. These local macOS arm64 results do not claim public availability or all-platform release qualification.
<!-- SECTION:NOTES:END -->
