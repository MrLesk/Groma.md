---
id: TASK-470
title: Build the web map once after the initial scan
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 19:34'
updated_date: '2026-09-20 19:39'
labels: []
dependencies: []
references:
  - web-server
modified_files:
  - test-bun/web-startup.test.ts
  - src/viewers/web/map-session.ts
  - docs/viewers/web/index.md
ordinal: 546000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Web startup routes saved architecture before scanning and routes it again after reconciliation. The first map is never shown; a measured Call for Papers startup spent 7.8 seconds on that discarded build.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Startup with scanning enabled builds the first map only after initial scan reconciliation, exactly once.
- [x] #2 Opening saved architecture without scanning and later live source updates still work.
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
Wait for initial scanner readiness, then place the first map load on the existing world queue; enable subsequent scan folds to queue behind that load. Close the scanner session if the first map fails. Update startup documentation. Extend the existing gated startup cases: user-approved ordering requires no map before scanning and exactly one first build; retain scanned results. Because callback activation changes, verify a later source addition appears through web events and reopening with scan:false preserves it without another scan. Use focused tests, the same isolated startup measurement, bun run check, implementer review, and a final full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The web map session now waits for scanner readiness before assigning its first map load to the existing world queue. Initial reconciliation callbacks do not access the map; later folds queue behind the first load. If the first load fails, the session closes the scanner watcher before propagating the startup error. Web startup documentation reflects the new order. This changes runtime ownership ordering only, with no OKF data or C4 boundary change.

Coverage correction: existing scanner-source-watch tests cover source batches, not the full web refresh path; extending web startup coverage closes that gap.

Confirmed startup regression failed before the production fix: both gated scan cases saw preparing-map before scanning. Final bun test test-bun/web-startup.test.ts passes all 4 tests (36 assertions). Coverage now rejects an early map build, counts one initial map build for nonempty and empty scans, observes a newly added source component through web events, and reopens that saved component with scan:false without another scanner call. The live fixture enumerates source files because scanner root names are not the visible component title.

Measured the same temporary Call for Papers project: startup 28.685748s before and 20.340142s after; first-map builds fell from two to one, with 119 elements and 141 relationships in both results. Routing now takes 7.493s once. One sample each; browser drawing excluded. Initial full check overlapped the test agent unfinished fixture and timed out waiting for a renamed root that is not a visible component; final fixture observes a newly added source component. Full check restarted on stable files.

Final bun run check passed: 16 Node tests; 623 Bun tests passed, 36 skipped, zero failures. Existing unrelated lint warning remains. Implementer specification/quality review traced scanner readiness, queued first load, live updates, scan:false, failure cleanup, and test assertions with no blockers. Final full-context complexity reviewer recommends keep: existing Web host ownership and queue are clear, initial-scan flag is necessary, no useful deletion or architecture change identified.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Web startup now scans and reconciles before building its first map once. Later source updates use the existing map queue; first-load failure closes the scanner session. Regression tests failed before the fix and now cover initial order/count, live updates, and scan:false saved architecture. Full repository check passed. Isolated Call for Papers startup improved from 28.69s to 20.34s with identical element/relationship counts; one sample per version, excluding browser drawing.
<!-- SECTION:FINAL_SUMMARY:END -->
