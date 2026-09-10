---
id: TASK-341
title: Avoid redundant duplicate-logic comparisons during scans
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-10 21:57'
updated_date: '2026-09-10 22:04'
labels: []
dependencies: []
references:
  - architecture-findings
modified_files:
  - src/architecture-findings.ts
  - test-bun/architecture-findings-performance.test.ts
  - test-bun/architecture-findings.test.ts
priority: high
type: bug
ordinal: 387000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Openclaw source extraction completes in 3.2 seconds but duplicate detection alone exceeds 30 seconds. Reduce repeated comparison work while preserving the existing duplicate findings, thresholds, and source coverage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The saved complete Openclaw observation finishes duplicate detection substantially faster than the reproduced baseline.
- [x] #2 Exact and similar duplicate clusters and their output remain unchanged, including transitive clusters and threshold boundaries.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Count each candidate token once; reject a pair only when its lengths or shared token multiplicities make the unchanged 0.7 LCS threshold impossible. Join similar pairs immediately and skip pairs already connected. Reuse existing findings test helpers for threshold, order, multiplicity and transitive-cluster regressions. Compare saved real observations and pass focused checks; root runs the full repository check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The initially added separate test file was removed before delivery; regression cases use the existing findings test helpers to avoid extra fixture code and dependence on TASK-334.

Controlled Openclaw baseline exceeded 30.008 seconds; changed duplicate detection completed in 5.518 seconds with 1,086 findings. Full pi-mono findings were byte-for-byte equal: baseline 27.618 seconds versus changed 0.389 seconds, 470 findings. All 18,852 named Openclaw operations also matched the baseline in consecutive batches of 100 (not a full cross-batch equivalence claim). Nine focused tests pass with 45 assertions; Biome passes. Own specification, quality and simplicity reviews found no blocker. No scanner contract, threshold, coverage, OKF or C4 change. Saved baseline, task-only patch and detailed evidence in /tmp/groma-accuracy-audit/fix-performance/. Root full repository check and commit/push remain pending.

Root verification passed: bun run check in current workspace (110 Node + 438 Bun, 7 optional-toolchain skips) and isolated HEAD checkout containing only the four audit fixes (110 Node + 424 Bun, 7 skips). No new lint warnings. Root reviewed task-only diff for scope and simplicity. Commit/push, cross-platform CI, and independent fresh review follow; task remains In Progress until delivery checks finish.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Preserves duplicate findings while avoiding impossible or already-connected comparisons. Verified full pi-mono output equality with a 27.6s to 0.39s reduction, complete Openclaw detection in 5.5s versus a 30s baseline timeout, nine focused tests and Biome. Awaiting the full repository check before finalization.
<!-- SECTION:FINAL_SUMMARY:END -->
