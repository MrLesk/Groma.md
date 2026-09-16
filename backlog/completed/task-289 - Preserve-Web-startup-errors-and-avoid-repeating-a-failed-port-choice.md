---
id: TASK-289
title: Preserve Web startup errors and avoid repeating a failed port choice
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 22:17'
updated_date: '2026-09-05 22:23'
labels: []
dependencies: []
references:
  - commands
  - web-server
modified_files:
  - src/cli.ts
  - test-bun/web-port.test.ts
  - docs/viewers/web/index.md
type: bug
ordinal: 328000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Web CLI replaces Bun EADDRINUSE errors with an occupied-port claim. In the restricted supported environment Bun can return that code for a failed port-0 bind, after which Groma suggests the same failed command. Preserve the underlying startup error and avoid treating a failed automatic port request as an occupied concrete port, while retaining existing behavior for a genuinely busy explicit port. No scanner, listener lifecycle, new retry policy or unrelated startup behavior changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When Web startup fails for port 0, the original error remains visible and the CLI neither suggests port 0 again nor offers consecutive-port retry.
- [x] #2 For a failed explicit or default port, the underlying runtime error is preserved; messages do not assert a permission cause from an ambiguous Bun code.
- [x] #3 Existing supported occupied concrete-port behavior, including the noninteractive available-port suggestion and interactive consent path, remains functional.
- [x] #4 Focused regression checks verify error preservation and port-choice behavior without requiring permission failure inference; bun run check passes.
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
1. Keep port-0 startup failures on the ordinary error path; show the runtime message for concrete-port failures while preserving existing consent and available-port choices.
2. Add isolated CLI regression cases for port 0, explicit/default ports, and accepting or declining a consecutive-port attempt; retain the real busy-port tests.
3. Document the terminal behavior, run focused Web port checks, and review task scope and acceptance evidence. The coordinating agent runs the complete repository check after shared CLI edits settle.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the two-line openWeb correction: port 0 rethrows the runtime failure directly; concrete-port guidance includes the original runtime message. No permission inference, scanner changes, listener changes, or new retry policy. Updated docs/viewers/web/index.md for both paths.
Verification: Bun 1.4.1 focused Web-port suite passes 8/8 with local socket access. The six isolated child-process cases prove failed port 0 makes one attempt and no prompt in either terminal mode; default/explicit concrete ports preserve the runtime message and available-port suggestion; declining makes one attempt; accepting makes consecutive attempts 5000, 5001, 5002 with one consent prompt. Both existing real occupied-port cases still pass, including no scan/subscriptions before bind failure. Biome lint of changed TypeScript and bun run typecheck pass.
Test harness corrections: initial module mock omitted Clack exports used by other CLI imports; it now preserves those exports and replaces only confirm. The child runs a temporary launcher file so Commander receives ordinary script arguments. Mock state is isolated per child; all tests use test.concurrent. Initial restricted socket tests reproduced the reported Bun port-0 EADDRINUSE behavior; socket-enabled verification passed.
Self simplicity review: no new production module or seam; one extra guard and the existing error-to-text pattern are sufficient. Specification/quality review found no task-scoped blocking defect. The command still owns port choice, and the server still owns binding/startup. Root will run bun run check after shared CLI edits settle and perform the requested final review. Task remains In Progress; no commit or push.

Final full-context complexity review passed with no material recommendations. The two-line production fix keeps port choice in the CLI and binding in the server. Final bun run check passed: 106 Node and 310 Bun tests, zero failures; lint and typecheck completed with seven pre-existing complexity warnings outside this task. Scope excludes concurrent camera/document changes; only the startup paragraph and openWeb hunk belong to this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Web startup now preserves the runtime error. A failed port-0 request exits without suggesting the same port or offering consecutive retries; concrete-port failures retain the existing suggestion and consent path. Verified by eight focused port cases, the full 416-test repository check, and specification, quality and full-context complexity reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
