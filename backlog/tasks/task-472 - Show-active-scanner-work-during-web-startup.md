---
id: TASK-472
title: Show active scanner work during web startup
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 20:01'
updated_date: '2026-09-20 20:18'
labels: []
dependencies: []
references:
  - scanner-registry
  - scanner-source-watch
  - scanner-session
  - startup-progress
  - web-server
  - web-page
modified_files:
  - src/scanner/registry.ts
  - src/scanner/source-watch.ts
  - src/scanner/session.ts
  - src/viewers/web/startup/progress.ts
  - test-bun/web-startup.test.ts
  - src/viewers/web/startup/page.ts
  - src/viewers/web/runtime.ts
  - src/viewers/web/map-session.ts
  - src/viewers/web/server.ts
  - docs/viewers/web/index.md
  - test-bun/scanner-session.test.ts
ordinal: 548000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The startup screen stays on a generic Scanning code label for several seconds, then jumps to the map. Developers cannot tell which scanners are still working or see map preparation while its synchronous calculation occupies the server.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 While scanning, startup names the scanners actually running and updates when a scanner finishes; skipped scanners are not shown as active.
- [x] #2 Architecture and map preparation status reaches the browser before the corresponding long map calculation finishes; the map still builds once after the scan.
- [x] #3 Existing first-run and regular-loading cards use the same real progress, including when the page connects during scanning, without simulated percentages or timed status rotation.
- [x] #4 Concurrent scanners appear as separate active rows with individual activity indicators, so their parallel execution is visible.
- [x] #5 Groma emits an explicit start and end event for each scanner invocation; end is emitted on success or failure and skipped scanners emit neither.
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
Groma's scanner registry emits one typed start/end pair around every actual scanner invocation, with end in finally and neither event for skipped scanners. The source watcher forwards these events. The scanner session owns the single active-scanner set and derives typed runtime progress.

The existing web startup domain formats scanner names, retains the complete current progress for initial HTML and late event-stream subscribers, and renders the same active rows in both loading cards. Each row has an activity indicator and disappears on completion or failure. Existing stage labels describe preparation, architecture updates, and map loading. The web host yields once before synchronous map calculation so its status reaches the browser; one initial map build remains unchanged.

These events describe transient runtime activity, not stored OKF knowledge or a new C4 concept. Existing scanner registry/session and Web host responsibilities own the behavior. No scanner plugin API or architecture semantics change.

Test authority and coverage: the user's per-scanner lifecycle requirement needs real registry event coverage. Extend the existing mixed-batch fixture to detect missing, duplicate, or early end events for a gated successful scan and a failure; an excluded scanner proves no invocation or event. Existing tests did not observe this protocol.

Test authority and coverage: the user's active scanner rows and late-page requirement need two concurrent scanner IDs, independent removal on success/failure, and current state after reconnect. Extend the existing gated web startup cases and preserve their one-map, no-scan, excluded-source, empty-result, and live-update checks. Use minimal scanner-name anchors for displayed state, not exact surrounding prose.

Verify both card views in a real browser with disposable fixtures, including independent completion and reload. Verify the reproduced narrow-screen card overflow with the existing layout allowed to shrink. Preserve the independent-client proof that map-preparation status arrives before map computation. Run bun run check and complete the implementer's specification/quality review plus Alex's requested full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced the hidden map-preparation status with an independent client process on the temporary Call for Papers project: map calculation ran from 1789934549436 to 1789934557114 (7.678s); the client received preparing-map at 1789934557115, after the calculation ended. This verifies that progress delivery needs an event-loop yield before synchronous map work. No live project architecture was scanned or modified.

Extended the existing startup fixture cases with two concurrent gated scanners. They verify both active IDs, removal after successful completion and failure, current-page labels and late SSE replay after the first scanner ends, and no active IDs retained after scanning. Existing excluded-source, no-scanner, empty-result, one initial map, saved-map/no-scan, and live-update checks remain. Regression proof: the extended gated cases fail against an isolated archive of baseline 463a17e578134e72c3404267c9b84e44fc322e1d at the missing scanner-ID assertion. Focused validation with final wiring: bun test --max-concurrency 1 --timeout 20000 test-bun/web-startup.test.ts test-bun/scanner-source-watch.test.ts passed 5 tests with 66 assertions; targeted Biome lint passed. Tests use only isolated temporary fixtures, and scanner-source-watch.test.ts was not changed.

Implemented typed runtime progress: the registry emits snapshots of scanner IDs only around actual scanner invocations and removes them in finally; the scanner session reports preparing-scanners when none is active. Startup progress formats IDs with the existing scannerName helper, retains full state for new SSE subscribers and initial HTML, and escapes dynamic names in HTML. The Web host yields its event loop only at the live startup preparing-map boundary; loadMapRoot awaits that boundary before synchronous map layout. Scanner plugin API, architecture meaning, and one initial map build remain unchanged. Focused Biome lint passed for all eight changed production TypeScript files; TypeScript passed. Docs describe execution ownership and the runtime-only status.

Browser QA on a temporary two-scanner fixture confirmed Scanning Java, TypeScript changes to Scanning TypeScript when Java completes, page reload retains the remaining scanner, and releasing TypeScript opens the map with no scanner warning. The loading card fits a 360px viewport without horizontal overflow. After-fix independent client receives preparing-map at 1789934772760, before map-start1789934772761; computation ends1789934780668 (7.907s later). This proves progress delivery during real work. All temporary preview servers and tabs closed. Parent specification/quality review found correct ownership and no task-scoped defects or worthwhile code deletions.

Before the row-layout refinement, full bun run check passed: 16 Node tests, 624 Bun tests, 36 skipped, zero failures. Full-context complexity review recommended keep with no blockers. Alex then requested separate parallel scanner work rows; implementing this UI refinement before finalization.

User-refinement validation: the existing mixed-batch registry test now proves one explicit ordered start/end pair for each successful or failed invocation, no end while the successful scanner is gated, and no events or invocation for an excluded scanner. Against an isolated copy of the prior active-snapshot registry, this test fails at the missing start event; it passes with explicit events. Web tests keep their active-ID, late-subscriber, initial-map, and live-update checks, and now read scannerNames plus the data-scanners HTML content for the separate rows. Final focused run passed 9 tests with 84 assertions across scanner-session, web-startup, and unchanged scanner-source-watch. Targeted Biome lint passed both changed test files. No additional fixture setup, production edits, or source-watch test changes were needed.

Applied the user refinement: ScannerRegistry now emits typed ScanEvent start/end pairs for each invoked scanner, with end in finally and no events for skips. Source watching forwards events; ScannerSession alone derives the active set. Startup progress formats separate scannerNames while retaining scanner IDs, and both existing card views render an individual spinner row per active scanner. Finishing or failing removes only that scanner row; there is no completed history or duplicate comma summary. Shared spinner reduced-motion CSS still applies, and the startup map-preparation yield is unchanged. Focused Biome lint for the five revised production files and TypeScript both pass. Source self-review found no ownership or supported-flow defect.

Browser QA reproduced a first-run startup card overflowing a 360px viewport with the project name Scanner progress preview: the body grid item kept its automatic minimum width (414.75px), preventing header truncation. Added only min-width: 0 to the existing main card rule so the grid item can shrink to its percentage width and the existing project-name ellipsis can apply. This is a CSS constraint fix for the reproduced startup flow; no new styling test was added. Parent is verifying both card views in the real browser.

Final browser QA verified both regular loading and first-run scanning through the actual setup forms: Java and TypeScript appear simultaneously as separate rows with one spinner each; releasing Java removes only its row; reloading preserves the remaining TypeScript row; releasing the last scanner opens the map. A 360px check reproduced first-run horizontal overflow with a long project name (scrollWidth427); allowing the main grid item to shrink fixes it. Both cards now have scrollWidth360 at viewport360. No live project was scanned.

Implementer specification and quality review: all five requested behaviors have objective lifecycle, browser, or independent-client evidence. Registry owns invocation events, session owns the single active set, and startup owns formatting/presentation/replay. Typed progress requires scanner IDs for scanning. Tests detect protocol and stale-state failures while allowing harmless copy/style changes. No new layer, dependency, stored concept, or supported behavior beyond the request; no blocking defect or worthwhile deletion found. Final full-context review and final repository check are pending.

Final validation after all code changes, including the card width fix: bun run check passed with 16 Node tests and 624 Bun tests, 36 skipped, zero failures; TypeScript passed. Biome reported only pre-existing findings outside this task. The focused lifecycle suite passed 9 tests with 84 assertions, and the explicit event regression fails against the prior snapshot-only implementation. git diff --check passed.

The final full-context complexity review recommends keeping the implementation: clear domain grouping, explicit invocation events, one active-set owner, and shared presentation reduce junior-developer mistakes. No code blockers, further deletion, or architecture changes were recommended. Its sole documentation note is resolved: the final plan says the session owns the active set. All temporary preview servers/tabs were closed. Unrelated architecture curation remains untouched.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Startup now shows each running scanner on its own row, driven by Groma's explicit per-invocation start/end events. End is emitted on success or failure; skipped scanners emit neither. Both startup cards and late connections share current progress. The server flushes map-preparation status before synchronous layout, preserving one initial map build. A reproduced narrow-screen card overflow is fixed.

Verified with gated lifecycle and startup tests, real-browser first-run/regular loading and 360px checks, independent-client timing, full bun run check (640 passing tests), and the final complexity review.
<!-- SECTION:FINAL_SUMMARY:END -->
