---
id: TASK-371
title: Remove manual scanner checks from settings
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 12:34'
updated_date: '2026-09-13 14:15'
labels: []
dependencies: []
references:
  - scanner-modules
  - scan-lifecycle
  - terminal-viewer
  - web-viewer
modified_files:
  - src/scanner/modules/settings-model.ts
  - src/scanner/session.ts
  - src/scanner/modules/settings.ts
  - src/viewers/tui/scanner-settings.ts
  - src/viewers/web/scanners/settings.ts
  - test-bun/scanner-settings.test.ts
  - test-bun/scanner-compatibility.test.ts
  - test-bun/scanner-settings-lifecycle.test.ts
  - docs/scanners/setup.md
  - docs/scanners/creating-a-plugin.md
type: enhancement
ordinal: 417000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scanner settings expose internal readiness bookkeeping as unfinished setup. Users should install a scanner and use Groma; only a reported failure needs an explicit retry.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Terminal and web settings omit Not checked, Check and Check again, including normal-state hints asking users to check.
- [x] #2 Installed scanners show concrete failures and offer Retry only while blocked; missing selections and recommendations keep Install.
- [x] #3 Retry runs the existing scan flow after the user fixes a failure; installing scanners and normal scanning require no manual preparation check, and failed scans preserve saved architecture.
- [x] #4 Real terminal and web interactions verify normal and failed states and successful retry; relevant business tests, documentation and bun run check pass.
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
Keep scanner preparation owned by plugin scan as required by the plugin contract. Replace settings check actions with retry through the existing session, simplify readiness labels and hints, and expose scanner failure messages. Verify a fixture plugin that fails until its tool marker exists, then retries successfully.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the shared settings action as Install/Restore or Retry only for a blocked installed scanner. Removed normal check labels, buttons, shortcuts and hints from both surfaces. Retry restarts the existing project scan; plugin scan owns requirement validation under the documented contract, so settings no longer run a separate preparation pass. Internal readiness remains available to the diagnostic CLI. No OKF metadata, stored architecture meaning or C4 concepts changed. Business validation: nine focused tests passed, including automatic failure after installation, saved architecture preservation and successful retry after restoring a required tool. Real browser and tui-test flows reproduced failure, displayed the concrete diagnostic and Retry, then removed both after successful retry. Captured normal, failed and retried states under retry-ui in the thread artifact directory. Full bun run check passed: 16 Node and 286 Bun tests; six existing native Rust/Go tests skipped. git diff --check passed. Specification and quality self-review found no remaining blocker; changes reuse the existing session and plugin contract without a new checking workflow.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed manual scanner checks and Not checked labels from terminal and web settings. Installed scanners need no verification action; failures show their diagnostic and Retry through the normal scan flow. Verified successful retry in both real UIs and passed the full repository check (302 tests, six existing skips).
<!-- SECTION:FINAL_SUMMARY:END -->
