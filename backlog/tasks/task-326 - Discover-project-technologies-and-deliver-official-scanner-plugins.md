---
id: TASK-326
title: Implement project discovery and official scanner support
status: Done
assignee:
  - '@codex'
created_date: '2026-09-08 21:32'
updated_date: '2026-09-12 14:25'
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
  - TASK-352
  - TASK-356
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
Developers working with multiple languages and nested applications need supported technology discovery, scanner selection, readiness and useful source evidence without Groma replacing language compilers. The implementation includes official C#, Java, Go, Rust, Angular, Vue and React plugins alongside embedded TypeScript, with reviewed local examples and shared-source evidence handling. Plugins own language-tool integration; core owns evidence composition, curated source ownership and relationship inference. Discovery and runtime configuration are not additional C4 elements or OKF metadata. This task closes the accepted implementation group. Public publishing and compatible catalog releases are consolidated in TASK-356. TASK-352 defines the retained domain-test boundary and supersedes automated package qualification requirements.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A project with multiple languages and nested applications produces an evidence-backed proposal covering all supported technologies found within the documented discovery scope; unsupported or uncertain discoveries remain visible.
- [x] #2 Users can review and adjust scanner recommendations and use the implemented exact-version installation and readiness journey, including a non-interactive path. The accepted local-package examples establish the implementation; public releases are owned by TASK-356.
- [x] #3 Official C#, Java, Go, and Rust scanners reuse the existing research work; a separate Angular plugin carries compatible TypeScript tooling alongside Groma's embedded TypeScript 7.1 SDK. All use established analysis tools and the shared evidence contract.
- [x] #4 ../callforpapers reaches a human-reviewed useful map with Java, Angular, and embedded TypeScript enabled; overlapping source evidence preserves one curated owner, complementary evidence is retained, and contradictory claims are reported without deriving a disputed relationship. An enabled scanner failure preserves the previous architecture.
- [x] #5 Users can rerun discovery as the project changes and distinguish installed support, recommended additions, and remaining coverage limits.
- [x] #6 The scanner implementation tasks retain their accepted local examples and review evidence. TASK-352 governs the domain-test boundary; all outstanding public package publishing, native distribution and catalog availability are recorded in TASK-356.
- [x] #7 Separate Vue and React scanners have recorded accepted framework interactions, shared-source ownership, rescan/failure preservation and local packed-consumer evidence using established analysis tools. Public distribution belongs to TASK-356.
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
Implement supported project discovery, shared scanner installation/readiness and compiler-backed language/framework plugins. Combine complementary scanner evidence without duplicating curated source ownership or deriving disputed relationships. Record local acceptance examples and reviews. Apply the TASK-352 domain-test boundary and consolidate all remaining public delivery into TASK-356.
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

Scope reconciliation approved by Alex on 2026-09-12: close the accepted implementation/local-evidence scope, apply TASK-352 removal of package qualification and CI test requirements, and consolidate all remaining public delivery in TASK-356. Revised criteria describe recorded completed behavior; older notes about waiting for publication or rebuilding qualification automation are superseded. Historical evidence and modified-file traceability are preserved. No source files or tests were changed or rerun for this task-record cleanup.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The scanner implementation group is complete: discovery, installation/readiness, seven optional language/framework plugins, shared-source composition and the reviewed local examples have recorded acceptance evidence. This administrative closure applies the TASK-352 test-policy change and transfers public publishing, native distribution and verified catalog releases to the single remaining TASK-356. It does not claim those releases are published.
<!-- SECTION:FINAL_SUMMARY:END -->
