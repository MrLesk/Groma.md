---
id: TASK-331
title: Add configurable scan exclusions
status: Done
assignee:
  - '@scan_exclusions'
created_date: '2026-09-09 21:34'
updated_date: '2026-09-09 21:50'
labels:
  - scanner
  - configuration
dependencies: []
references:
  - 'https://git-scm.com/docs/gitignore'
  - scanner-modules
  - scan-lifecycle
documentation:
  - docs/scanners/index.md
  - docs/component-markdown.md
modified_files:
  - package.json
  - bun.lock
  - src/scanner/modules/config.ts
  - src/scanner/modules/inventory.ts
  - src/scanner/registry.ts
  - test-bun/scanner-exclusions.test.ts
  - docs/scanners/index.md
  - groma/scanners.json
priority: medium
type: feature
ordinal: 377000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer adds folder paths or glob patterns to Groma scanner configuration, subsequent scans omit matching source evidence across enabled scanners. Use familiar Git ignore pattern rules with repository-relative paths; the approved example is excluding the repository-root scripts folder. The user explicitly chose to retain existing map components rather than delete or hide stored architecture. Existing component ownership and authored Markdown must remain intact. The current TypeScript include/ignore lists are internal defaults, not a user-facing project setting. Extend the existing scanner configuration with one shared exclude list; do not add a separate include feature, UI editor, cleanup command, or historical-state migration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A project can configure a shared exclude array with standard Git ignore path and glob semantics; /scripts/ excludes the root scripts folder and documented wildcard examples behave consistently on supported operating systems.
- [x] #2 Configured exclusions apply to new evidence from every enabled scanner and source-watch matching, while no configured exclusions preserves existing behavior and language defaults.
- [x] #3 A rescan does not create components or derived interactions from excluded source evidence, including when more than one scanner reports that file. Existing stored components, ownership, and authored content are retained, as explicitly chosen by the user.
- [x] #4 Scanner add/remove/setup writes preserve configured exclusions; documentation explains the location, examples, defaults, and that exclusions do not remove components already stored on the map.
- [x] #5 Focused concurrent fixture tests, bun run check, and the required simplicity/specification/quality/context reviews pass with recorded evidence; the supported scripts-folder example is demonstrated without changing unrelated architecture.
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
1. Extend scanner configuration with an optional shared exclude string array and preserve it through module add/remove/setup writes.
2. Use the established ignore matcher with repository-relative Git ignore patterns in the shared registry; filter completed evidence and watched paths without changing compiler inputs or scanner failure handling.
3. Add concurrent fixture coverage for root and wildcard rules, multi-scanner evidence closure, stored ownership/authorship retention, unchanged defaults and config writes; document usage and reload behavior.
4. Run focused checks, hand off cold simplicity review to root, perform specification/quality review, and wait for coordinated full check and final context review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Exclusions belong to scanner policy owned by Scanner modules and Scan lifecycle. They add no OKF concept, C4 element, or architecture metadata. Ordinary Markdown readers retain readable authored records; Groma alone interprets scan selection. Shared language-neutral path matching avoids TypeScript-specific policy. Compiler source context remains available; exclusions select returned evidence, not compiler inputs.

Implemented shared optional exclude configuration with ignore 7.0.9, using case-sensitive Git ignore patterns. Config mutation preserves the full config. Registry filters completed observations from every enabled scanner and source-watch matches; removes associated placements/scopes, relationships, operations and whole invocation claims that touch excluded evidence. Empty filtered observations do not create empty architecture. Compiler input and Promise.allSettled failure handling remain unchanged. Documentation explains both config roots, root-folder/glob/negation examples, defaults, active watcher restart and retention of stored/authored records.
Focused checks passed: 20 tests / 170 assertions across scanner-exclusions, scanner-modules, scanner-setup and scanner-composition. After strengthening retained-invocation and all-excluded evidence assertions, scanner-exclusions passed 5 tests / 67 assertions. Typecheck and targeted Biome lint passed with no warnings. Initial test-only misuse of AnnotatedElement.sourceFilename was corrected by snapshotting architecture documents. No live architecture records or TASK-330 files changed.

After the cold simplicity gate passed, implementer specification review verified AC1 with root-folder, recursive glob, negation, excluded-parent, range, escaped-prefix and native path tests; AC2 with all three enabled scanners, watch matcher assertions, and absent/empty config equivalence; AC3 with contract round-trip validation, retained valid invocations, dropped whole mixed-target claims, no excluded new components, and two rescans preserving all existing components/authored documents and relationships; AC4 with add/remove/setup in both roots and published scanner guide examples. AC5 and remaining DoD gates await coordinated full check and full-context review.
Implementer quality review found no reproducible defect in the declared supported flow or unnecessary new production abstraction. Registry owns selection and scanner completion; configuration module owns parsing and serialization. Changed production functions passed Biome complexity/lint checks. Language scanner contracts, compiler inputs, reconciler and source watcher lifecycle are unchanged. Existing failed-scanner and missing-module tests passed. The seven changed files are task-scoped; 26 pre-existing untracked architecture records remain untouched.

Final gates supplied by root: bun run check passed 110 Node tests and 413 Bun tests (523 passed total, 7 existing tool-dependent skips, zero failures); log /tmp/groma-task331-check.log. Cold simplicity and final full-context complexity reviews both passed, with no requested code changes or material simplifications. Root applied the approved live /scripts/ configuration using readScannerConfig/writeScannerConfig and immediately tracked groma/scanners.json. Registry collection selected 258 files, zero under scripts/; source-watch matching rejected scripts/build.ts and accepted src/scanner/registry.ts. All 146 existing architecture Markdown files remained byte-identical to the pre-example snapshot. Log /tmp/groma-task331-live-example.log. All acceptance criteria and Definition of Done checks have evidence. Status stays In Progress pending root commit coordination with TASK-330; no further implementation work remains.

The final combined working tree passed bun run check after the Windows source-watch correction and diagnostic cleanup: 110 Node tests plus 414 Bun tests, seven existing tooling skips, zero failures. Both independent simplicity reviews found no material recommendation. The configured /scripts/ example and all 146 unchanged architecture documents were verified through the new repository code; installed global CLI distribution was not updated. No further implementation change remains.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a shared exclude array using standard Git ignore matching across enabled scanner evidence and source-watch paths. Scanner configuration writes preserve the list; existing architecture ownership and authored Markdown remain intact. Configured /scripts/ for this project and verified zero scripts evidence without changing any existing Markdown. Focused checks, 523 repository tests, and all required reviews passed (7 existing tool-dependent skips).
<!-- SECTION:FINAL_SUMMARY:END -->
