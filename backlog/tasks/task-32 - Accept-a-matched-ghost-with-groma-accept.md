---
id: TASK-32
title: Accept a matched ghost with groma accept
status: Done
assignee:
  - '@alex'
created_date: '2026-08-15 13:40'
updated_date: '2026-08-16 19:05'
labels: []
dependencies:
  - TASK-31
references:
  - docs/product-model.md
documentation:
  - docs/product-model.md
priority: high
type: feature
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone runs `groma accept <id>`, Groma applies that planned ghost only if a scan has matched it. No match: the command fails and the ghost stays planned. A scan never accepts on its own. Groma may scan first if needed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `groma accept <id>` applies a matched ghost into observed
- [x] #2 No scan match: the command fails and the ghost stays planned
- [x] #3 A scan never accepts a ghost by itself
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
1. Add `acceptGhost` in core: load the world, require a planned document for the id, treat a non-empty `code` frontmatter as the scan match, copy that document to `groma/observed/` (same path under the plan), remove a restated observed file if its path changed, and delete the planned file. Do not invent evidence or rewrite the body.
2. Wire `groma accept <id>` in the CLI. If the ghost exists but has no `code`, run one `groma scan` fold and try again. Print `ok` on success; fail with a short stderr reason and leave the ghost planned. Scan still only folds.
3. Cover the three ACs with fixture-owned Node tests: matched new ghost, restated observed id, unmatched after scan, scan-alone still leaves the ghost planned, and CLI accept of a source-matched ghost (scan-first) plus CLI failure when nothing matches.
4. Keep docs as they already specify this command; only change the CLI usage string.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Match is non-empty `code` on the planned document (what fold already writes). Accept copies that file to groma/observed/ at the same path under the plan, overwrites a restated observed document, deletes the old observed file if the path changed, and removes the planned file. CLI scans once only when the ghost exists but has no code. Scan still only folds.

Verification: node --import=tsx --test test/accept.test.ts test/scan.test.ts test/cli-scan.test.ts 15/15. bun run check: tsc clean, 61/61 node, 36/36 bun. Cold simplicity PASS (no deletions). Specification PASS. Quality PASS.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`groma accept <id>` now applies a planned ghost only after a scan has attached `code`. No match: the command fails and the ghost stays planned. A scan still never accepts on its own; accept may run one scan first if the ghost has no code yet.

Verified with fixture tests: matched new ghost, restated update and path move, unmatched failure, fold-then-accept handshake, CLI scan-first success on a name match, and CLI failure when nothing matches. bun run check passed (61 node, 36 bun).
<!-- SECTION:FINAL_SUMMARY:END -->
