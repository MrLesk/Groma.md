---
id: TASK-228.3
title: Show scanner readiness in the Groma welcome
status: Done
assignee:
  - '@codex'
created_date: '2026-08-31 18:09'
updated_date: '2026-09-01 16:58'
labels: []
dependencies:
  - TASK-227
  - TASK-228.2
references:
  - welcome
  - scanner-modules
modified_files:
  - src/welcome/model.ts
  - src/welcome/view.ts
  - src/welcome.ts
  - src/cli.ts
  - test-bun/welcome.test.ts
  - test/instructions.test.ts
  - docs/scanners/index.md
  - groma/observed/systems/groma/containers/cli/components/welcome.md
parent_task_id: TASK-228
priority: high
type: enhancement
ordinal: 247000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer launches bare Groma. The welcome reads the shared scanner inventory and shows a compact readiness summary without adding scanner management to the primary action list. The Advanced commands section created by TASK-227 contains the scanner management command references.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The welcome shows the embedded TypeScript scanner and every enabled project scanner with built-in, found, or missing readiness derived from the shared scanner inventory.
- [x] #2 Rendering the welcome resolves manifests and installation state but does not execute third-party scanner code or perform network work.
- [x] #3 Scanner add, install, list, and remove appear only as read-only references inside Advanced commands, not as primary launcher actions.
- [x] #4 Interactive and plain welcome output remain understandable when no optional scanner is configured and when one is missing.
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
1. Load the shared scanner inventory at the Welcome model boundary and project only scanner id plus built-in/found/missing readiness; keep the controller and painter pure by passing them a fully loaded model.
2. Add one compact scanner row to the shared interactive context box and plain welcome output, preserving the existing primary launcher actions.
3. Add scanner add, install, list, and remove only to the existing read-only Advanced commands data.
4. Cover empty/optional/missing inventory, no plugin execution, plain projection, and unchanged non-dispatch navigation with parallel-safe fixtures.
5. Update scanner documentation and the observed Welcome relationship/counts, then run focused/full checks and the required simplicity, specification, quality, and full-context complexity reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one async Welcome model load that projects only scanner id and readiness from the shared inventory. Interactive and plain rendering consume the same compact summary; scanner management remains four read-only Advanced references. Focused TypeScript, 9 Welcome tests, and 9 CLI/plain tests pass.

Manual 80x50 frame verification shows the compact built-in summary, all four scanner references inside Advanced commands, complete borders, and no scanner reference selection. The full check passed lint, TypeScript, 94/94 Node tests, and 218/219 Bun tests; the one concurrent web live-watch timeout passed 1/1 in isolation.

Cold simplicity review passed with no findings. It confirmed the smallest flow is one inventory load at the model boundary, one id/readiness projection, one shared formatter, and the existing non-selectable Advanced command projection.

Final full-check evidence: both runs passed Biome/TypeScript and all 94 Node tests. Each concurrent Bun run reached 218/219 but timed out on a different unrelated live watcher; both timed-out cases passed immediately in exact isolated reruns. All 18 task-focused tests and type checking pass.

Specification and quality reviews passed with no findings. The required full-context complexity review also recommends keeping the implementation unchanged: scanner discovery stays in the scanner domain, Welcome projects only id/readiness, one formatter serves both outputs, and Advanced rows remain non-dispatchable.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bare Groma now loads the shared scanner inventory once and shows compact built-in, found, or missing readiness in both interactive and plain Welcome output. Scanner add, install, list, and remove remain read-only Advanced references. Verified with TypeScript, 9 Welcome tests, 9 CLI/plain tests, a manual 80x50 terminal frame, isolated live-watcher reruns, and cold simplicity, specification, quality, and full-context complexity reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
