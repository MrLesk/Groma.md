---
id: TASK-391
title: Keep the first source edit visible in live scans
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-13 21:12'
updated_date: '2026-09-13 21:23'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Groma.md/actions/runs/34782921789'
  - scanner-source-watch
  - scanner-session
modified_files:
  - src/scanner/source-watch.ts
  - src/scanner/session.ts
  - test-bun/scanner-source-watch.test.ts
  - docs/scanners/setup.md
type: bug
ordinal: 437000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The macOS CI run for commit a394ecd8 failed because the live scanner session did not receive the source edit after startup. The same failure occurred locally on run 20. This blocks the requested v0.3.2 hotfix. Find the cause before release. Preserve the failure recovery checks and the existing timeout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A source edit made after session setup reaches the healthy scanner while other scanners report failures.
- [x] #2 The test keeps its evidence, failure, and recovery assertions without sleeps, retries, or a larger timeout.
- [ ] #3 The repository checks and the macOS CI job pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce the missing first event. 2. Start the source subscription before the initial scan. Use the existing serial scan queue for both startup and edits. 3. Verify startup edits and unchanged failure recovery checks. 4. Run repository checks and macOS CI before release.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The existing test failed on local run 20 with the same three-second timeout as CI. An isolated sequence of 100 Parcel subscriptions passed. Concurrent event tracing is in progress.

Buffered tracing captured the failing run with a completed subscription but no source-event callback. Compare the macOS kqueue backend, which installs kernel watches during subscription, against the failing FSEvents path. Do not change test timing or assertions.

The kqueue comparison crashed during concurrent watcher teardown, so it was rejected. Keep the existing backend. Correct the startup order: subscribe before the initial scan, and run the initial batch through the same serial queue as file edits.

The original three lifecycle tests passed in 100 consecutive local runs. The new source-watch regression changes a source file during the initial scan and verifies that a later scan receives the edit after the initial batch is applied. Eight focused tests passed. Specification and quality review: the change preserves scanner selection, failure isolation, and saved evidence, uses the existing queue, and adds no watcher backend or retry behavior.

bun run check passed: lint, type checks, 16 Node tests, and 312 Bun tests (6 optional native-tool tests skipped). The working tree includes a separate uncommitted Python scanner task; release validation will also run against only the committed hotfix on GitHub.
<!-- SECTION:NOTES:END -->
