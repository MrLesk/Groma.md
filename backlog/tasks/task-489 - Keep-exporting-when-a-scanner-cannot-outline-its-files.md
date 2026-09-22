---
id: TASK-489
title: Keep exporting when a scanner cannot outline its files
status: Done
assignee:
  - '@claude'
created_date: '2026-09-22 21:36'
updated_date: '2026-09-22 21:50'
labels: []
dependencies: []
references:
  - source-read
modified_files:
  - test-bun/code-outline.test.ts
  - src/viewers/source/structure.ts
  - docs/scanners/creating-a-plugin.md
type: bug
ordinal: 570000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
groma export stops with a stack trace when a configured scanner cannot produce source outlines, for example when the Go scanner's native worker is a local build that is missing from a fresh worktree. Export reads every component's outline through the shared outline reader, and one scanner that throws rejects the whole read. groma scan in the same situation keeps the saved data and carries on. The live browser map already shows no outline when the read fails, but the terminal map calls the same reader without handling the error. Alex asked for export to carry on like scan does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma export completes when a configured scanner fails to load or to outline; that scanner's files are published without declarations while other scanners' outlines remain
- [x] #2 Component details in the terminal and browser maps show the outlines the remaining scanners can read, without an error, when a component's Code includes a failing scanner
- [x] #3 The scanner plugin guide states that a scanner which cannot load or outline contributes no outline
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
1. src/viewers/source/structure.ts owns reading outlines for every viewer and for export. In readSnapshotCodeStructure, load each needed scanner and read its outline in one step per scanner; when that step throws (the module fails to load, or its outline hook fails, such as a missing native worker), that scanner contributes no outline, exactly as a scanner without the hook does. The other scanners' outlines are still returned, so export completes and the terminal map never sees a rejected read. This also merges the two Promise.all passes into one.
2. docs/scanners/creating-a-plugin.md, Source outline: one sentence stating that a scanner which cannot load or outline contributes no outline.
3. Test authority: the reproduced failure (groma export in a worktree without the Go worker stopped with GO_WORKER_MISSING) and the documented rule that a scanner without the outline hook contributes no outline. Wrong result detected: one failing scanner rejects the whole outline read. Coverage gap: test-bun/code-outline.test.ts covers two working scanners only. Smallest test: extend it with one case that copies the mixed-scanner fixture to a temporary directory, replaces the beta plugin with one whose outline throws, and expects only alpha's outline.
4. Verify: bun run check; reproduce the original failure in a throwaway worktree without the Go worker, and confirm export now completes.
This changes outline reading only; it adds no OKF knowledge or C4 concept.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in src/viewers/source/structure.ts: readSnapshotCodeStructure now loads and asks each needed scanner in one step per scanner. When that step throws (import failure, or an outline hook failing such as a missing native worker), the scanner contributes no outline, like a scanner without the hook, and the other scanners' outlines are still returned. The two Promise.all passes became one. docs/scanners/creating-a-plugin.md states the rule under Source outline.

Verification: the new code-outline test (a copy of the mixed-scanner fixture whose beta outline throws) failed before the fix with BETA_WORKER_MISSING and passes after; all 5 outline tests pass. In a throwaway worktree of HEAD plus this change, where the Go and Rust workers are not built, groma export (which failed before with GO_WORKER_MISSING) completed and wrote the site. Its snapshot has no outline for go-analysis, go-http and rust-analysis, and keeps TypeScript outlines (src-core: 4 files, 35 declarations; camera: 3 files, 20 declarations). The call the terminal map makes, readCodeStructure, returned 0 outlined files for go-analysis instead of rejecting, and 4 for src-core. bun run check on that snapshot passed: 16 Node, 674 Bun pass, 43 skip, 0 fail.

Full-context review (general-purpose agent with a written brief; the fork type is unavailable): ship as is. It confirmed the rule belongs in the shared reader, the import stays inside the try as loadScannerRegistry already treats an import failure as that scanner's failure, the failure stays silent like the live browser and the no-hook rule, callers stay unchanged, and the test and guide sentence stay. Optional separate follow-up: one concept has two names, outline and structure (readCodeStructure, codeStructure, structure.ts), which touches the plugin contract and needs its own task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma export no longer stops when a configured scanner cannot load or outline its files, such as a scanner missing its native worker. The shared outline reader in src/viewers/source/structure.ts now treats such a scanner like one without the outline hook: it contributes no outline and every other scanner's outline remains, for export, the terminal map and the browser map alike. The plugin guide states the rule. Verified by a regression test that failed before the fix, an export in a worktree without the Go and Rust workers that now completes with TypeScript outlines intact, the terminal map's outline call returning an empty outline for a Go component instead of rejecting, and bun run check on the exact snapshot.
<!-- SECTION:FINAL_SUMMARY:END -->
