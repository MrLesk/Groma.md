---
id: TASK-155
title: Start the web viewer on a chosen port
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 18:22'
updated_date: '2026-08-23 18:26'
labels: []
dependencies: []
references:
  - commands
modified_files:
  - src/cli.ts
ordinal: 166000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer can start the browser map on a chosen local port, so several Groma web viewers can run at the same time without competing for the default port.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running bun run cli web --port 4848 starts the web viewer on port 4848 and reports that URL
- [x] #2 Running bun run cli web without --port continues to use port 4747
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
1. Add the web command's numeric --port option and pass it to the existing startWebViewer port option.
2. Verify the public CLI help, a viewer on port 4848, and the unchanged default port 4747 with short-lived real CLI processes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the web command's numeric --port option by passing it to the existing startWebViewer port option. Verification: CLI help lists --port; bun run cli web --port 4848 reported http://localhost:4848 and served HTTP 200; bun run cli web reported the unchanged http://localhost:4747; test/cli-view.test.ts passed (5 tests). Repository-wide typecheck is presently blocked by unrelated in-progress selection work in src/viewers/web/render.ts and test-bun/web-url.test.ts.

Cold simplicity and full-context complexity reviews both passed with no findings. The Commander option is the public CLI contract and appears in groma web --help; no separate documentation or new abstraction is needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added --port to groma web by forwarding the parsed value to the server's existing port option. Verified port 4848 with the real CLI and an HTTP 200 response, verified the unchanged 4747 default with the real CLI, confirmed the help output, and passed all 5 focused CLI view tests.
<!-- SECTION:FINAL_SUMMARY:END -->
