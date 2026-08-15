---
id: TASK-31
title: Run groma scan once and fold results into Markdown
status: Done
assignee:
  - '@scan'
created_date: '2026-08-15 13:40'
updated_date: '2026-08-15 13:51'
labels: []
dependencies: []
references:
  - docs/scanners/index.md
  - docs/product-model.md
documentation:
  - docs/scanners/index.md
modified_files:
  - src/cli.ts
  - src/core.ts
  - src/markdown-emitter.ts
  - src/scanner.ts
  - src/types.ts
  - src/typescript-scanner.ts
  - src/scanner-process.ts
  - package.json
  - test/scan.test.ts
  - test/cli-scan.test.ts
  - features/scan.feature
priority: high
type: feature
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone runs `groma scan`, Groma runs the TypeScript scanner plugin once, core folds the candidates into Markdown, and the command prints `ok` plus a short summary and exits. It does not print the architecture. Observed matches refresh only `code`. Ghost matches attach `code` and stay planned. Unknown candidates become new observed files. A scan never accepts a ghost.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `groma scan` runs once, prints `ok` and a short summary, and exits
- [x] #2 The command does not print elements, IDs, or a machine-readable architecture
- [x] #3 Core refreshes `code` on an observed match and leaves the body alone
- [x] #4 A ghost match attaches `code` and stays planned
- [x] #5 A candidate that is not in the world becomes a new observed file with a readable ID
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
1. Replace the watcher user path with one-shot `groma scan`: run the TypeScript plugin once, fold in core, print `ok` plus a counts-only summary, exit. Keep `groma view`. Do not add accept or TUI work.
2. Change the shared scan result to candidates only (kind, recognizable name, responsibility, parent name, optional code). No architecture IDs.
3. Because the TypeScript contract has no approved source shape, the plugin returns an empty candidate list. Core still folds whatever the plugin returns.
4. Core matching: existing `code` reference, else kebab-case of the name. Observed match refreshes only `code` and keeps the body. Ghost match (planned ID wins) attaches `code` and stays planned. Else write a new observed file with that kebab-case ID under the existing parent.
5. Delete the obsolete watcher process, Groma-typed scanner contract, owned-subtree emitter, and the tests/fixtures that encode them.
6. Add focused tests for CLI output and the three fold cases.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TypeScript plugin returns no candidates: docs/scanners/typescript/contract.md has no approved source shape, so groma scan has no mapping to apply. Core still folds whatever the plugin returns.

Matching: existing code reference, else kebab-case name. Planned ID wins over observed for that ID. Observed match refreshes only code. Ghost match writes code on the planned file. Else create observed file. Scan never moves a ghost to observed.

Summary format: `created N, refreshed N, matched N` after `ok`.

Simplicity pass: removed watcher/process, Groma-typed scanner, owned-subtree emitter, test-only fold seam, and leftover MarkdownEmissionError.

Verification:
- `bun src/cli.ts scan` → `ok` / `created 0, refreshed 0, matched 0` / exit 0
- `node --import=tsx --test test/scan.test.ts test/cli-scan.test.ts` — 5 pass (CLI output; plugin has no IDs; observed body preserved; ghost stays planned; stock-checker.md created)
- `bun run check` — tsc 7.0.2; architecture 12 observed + 1 planned; 52 Node; 6 TUI
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma scan now runs the TypeScript plugin once, folds candidates in core, prints ok plus a counts-only summary, and exits. Observed matches refresh only code. Ghost matches attach code and stay planned. Unknown names become new observed files. Verified with bun src/cli.ts scan, focused scan/CLI tests, and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
