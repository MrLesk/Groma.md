---
id: TASK-448
title: Simplify scanner settings and skip scans with fully excluded sources
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 21:42'
updated_date: '2026-09-19 21:54'
labels: []
dependencies: []
references:
  - scanner-registry
  - modules-readiness
  - scanners-settings
modified_files:
  - test-bun/scanner-exclusions.test.ts
  - src/scanner/registry.ts
  - src/scanner/modules/readiness.ts
  - src/viewers/web/scanners/settings.ts
  - docs/scanners/setup.md
  - docs/scanners/index.md
type: bug
ordinal: 520000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In web Settings → Plugins, a single Swift recommendation repeats installation controls, uses a green Not installed badge, and presents source detection like an installation location. Vue also reports ENOENT for an external script in test fixtures even though all Vue sources are excluded by the project configuration. The user approved fixing both screenshots.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Web scanner rows are compact; detected files are clearly named and revealed through an expandable matching-files control instead of a Found in subtitle.
- [x] #2 A recommendation has one individual Install action and no green Not installed badge; Install all appears only when more than one recommendation can be installed.
- [x] #3 Existing scanner actions, diagnostics, search, and expanded details remain usable at desktop and narrow widths.
- [x] #4 Readiness and scanning do not execute a scanner when its source listing contains only files excluded by the existing shared configuration; the excluded Vue external-script fixture no longer produces ENOENT.
- [x] #5 A scanner with included source still runs and reports real failures; focused checks and bun run check pass.
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
1. Compact the existing web scanner renderer, move detection information into details, and show bulk install only for multiple actionable recommendations. 2. Use the existing source-listing contract before scanner execution and readiness when shared exclusions remove every listed source; retain the current observation filtering for partial exclusions. 3. Reproduce the Vue failure with an isolated copy of its existing test fixture, cover scanner lifecycle behavior, and inspect the UI at desktop and narrow widths. 4. Update the scanner documentation, run bun run check, and perform specification and quality reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
This changes operational scanner selection and presentation, not architecture meaning. It introduces no OKF concept, metadata, C4 element, or containment level. Ordinary Markdown and OKF readers keep the same records and links; the existing scanner registry owns shared exclusions. The rule uses source listings and configured patterns across languages, with no special case for Groma paths. Active tasks have no overlapping code files.

The new regression reproduced the screenshot error before the fix: excluded fixtures/vue/logic.ts raised ENOENT during scanning. Vue readiness itself passed because external source files are opened later during evidence collection; a separate failing-hook fixture verifies the readiness exclusion guard without changing Vue validation behavior.

Focused checks: 16 tests pass with watcher access; the sandbox-only run failed to start macOS FSEvents. Browser preview uses the real production renderer and temporary sample data. Single install, multiple recommendations with Install all, expanded matching files, file filtering, and preserved details after state changes work. Narrow-screen review found wrapped action placement; the header now keeps its action in a dedicated grid column at that width. The first full check passed 16 Node and 610 Bun tests (36 configured skips); new complexity warnings were simplified before the final run.

Final verification: bun run check exited 0 after the final code changes (16 Node tests; 610 Bun tests passed, 36 configured skips, no failures). The only complexity warning is in unchanged test-bun/iso-map.test.ts; all four changed TypeScript files pass Biome without findings. Browser verification with the real renderer and temporary sample data covered single and bulk installation actions, expanded matching files, file filtering, retained expansion/filter state after installation, diagnostics, retry, and desktop/375px layouts. A read-only smoke check against this repository found 19 Vue source files, zero included sources, zero observations, and zero failures. No live architecture records were written. git diff --check passed. Specification review matched all five acceptance criteria and project DoD. Quality review traced Settings through the existing renderer/actions and scanner configuration through source listing, readiness, and collection; source settings are preserved, included source still reports errors, and the shared registry continues to filter partial observations. The change stays within existing scanner responsibilities, with no new modules, dependencies, formats, or architecture concepts. No blocking findings remain.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Compacted web scanner settings, removed the misleading Not installed badge and Found in subtitle, labeled expandable matching files, and limited bulk installation to groups with multiple installable scanners. Shared readiness and execution now skip a scanner when every listed source is excluded, fixing the Vue fixture ENOENT while retaining failures for included source. Verified the real renderer in desktop and narrow previews, two regression cases, the current repository Vue source scope, and the full repository check (16 Node and 610 Bun tests passed; 36 configured skips).
<!-- SECTION:FINAL_SUMMARY:END -->
