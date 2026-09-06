---
id: TASK-311
title: Fix CI live-web tests and current GitHub Actions
status: Done
assignee:
  - '@alex'
created_date: '2026-09-06 18:12'
updated_date: '2026-09-06 18:42'
labels:
  - ci
dependencies: []
references:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - test-bun/web-live.test.ts
  - src/architecture-watch.ts
  - architecture-watch
modified_files:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - src/architecture-watch.ts
  - test-bun/web-live.test.ts
  - groma/systems/groma/containers/view-host/components/architecture-watch.md
  - backlog/tasks/task-311 - Fix-CI-live-web-tests-and-current-GitHub-Actions.md
ordinal: 349000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub Actions CI failed on Ubuntu and Windows in the Bun viewer suite. The Ubuntu job timed out waiting for a first scan to appear on the live web map. The Windows job aborted the architecture-Markdown SSE fetch. Update both workflows to the current GitHub Action majors so checkout is no longer forced off Node 20, and make those live-web tests pass without weakening their behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CI and release workflows use the current GitHub Action majors for checkout, setup-node, upload-artifact, and download-artifact.
- [x] #2 Starting the web map without a scan, then scanning, publishes the scanned architecture on the live map.
- [x] #3 A live architecture Markdown change is published on the event stream without aborting the stream to wait.
- [x] #4 bun run check passes.
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
1. Bump workflow actions to checkout v7, setup-node v7, upload-artifact v7, and download-artifact v8. 2. Reload the live architecture map on any watched groma-folder event so a first scan that creates new directories is not missed. 3. Pump the SSE body in the background and drop AbortSignal.timeout from long-lived /events fetches so Windows waitUntil can observe the pushed world. 4. Run the focused live-web tests and bun run check.

5. After cold simplicity review: drop unused /events in the first-scan test, share the pumpSse one-liner, and comment why watch is not .md-only.

6. Update the Architecture watch overview through groma edit so it is not Markdown-only.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Specification review: AC1 matches current majors from gh api (checkout v7.0.1, setup-node v7.0.0, upload-artifact v7.0.1, download-artifact v8.0.1) via floating @v7/@v8 tags. AC2–AC3 proven by passing live-web tests; AC4 by bun run check. Quality: watch any groma-folder event is the smallest fix for missed directory creates; pumpSse keeps the SSE open instead of aborting it. No public docs needed; CONTRIBUTING already does not document the old .md-only filter.
Validation: bun test --timeout 20000 test-bun/web-live.test.ts — 8 pass. bun run check — 6 pre-existing Biome complexity warnings, 109 Node tests, 340 Bun tests, 0 fail.

Cold simplicity review (after Done): simplest approach stands. Apply: drop unused /events fetch in the first-scan test; use the same pumpSse one-liner in the Markdown-change test; comment why the watch is not .md-only.

Targeted re-review: all three findings applied, no regressions. Spec/quality: ACs unchanged; pumpSse still the shared SSE helper; first-scan test now only uses world.json. Architecture Markdown still says Markdown-only; left as a non-blocking follow-up because Groma-owned files are not edited directly.
Post-review validation: bun test --timeout 20000 test-bun/web-live.test.ts — 8 pass. bun run check — 109 Node + 340 Bun, 0 fail.

Updated Architecture watch overview through groma edit: watches the Groma directory for architecture changes, including new folders from a first scan. Verified with groma view architecture-watch.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
CI and release workflows now use checkout@v7, setup-node@v7, upload-artifact@v7, and download-artifact@v8. Live architecture reloads on any groma-folder watch event so a first scan is published. Live-web tests pump SSE in the background instead of aborting the stream. Architecture watch overview now names directory events, not Markdown-only. Verified with bun test --timeout 20000 test-bun/web-live.test.ts (8 pass), bun run check (109 Node + 340 Bun, 0 fail), and groma view architecture-watch.
<!-- SECTION:FINAL_SUMMARY:END -->
