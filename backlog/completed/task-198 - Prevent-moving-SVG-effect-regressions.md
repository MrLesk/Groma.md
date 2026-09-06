---
id: TASK-198
title: Prevent moving SVG effect regressions
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 19:31'
updated_date: '2026-08-27 19:35'
labels: []
dependencies: []
references:
  - iso-map
modified_files:
  - test-bun/web-svg-performance.test.ts
  - AGENTS.md
type: chore
ordinal: 210000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Keep Web map camera movement smooth by preventing patterned or filtered background surfaces from becoming descendants of the moving SVG camera group. Record the rendering invariant for future changes and enforce the known safe grid topology in the standard repository check.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The standard repository check rejects a Web map implementation that nests the patterned grid field inside the moving camera group, with a clear remediation message
- [x] #2 The current root-level grid field and camera topology passes the guard
- [x] #3 Project instructions explain that patterned or filtered SVG surfaces stay outside moving transform groups and require frame-rate validation when camera rendering changes
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
1. Add one focused validator for the Web map SVG composition: the patterned field must be appended beside the camera, never inside it.
2. Run the validator from the standard repository check and document the rendering rule in AGENTS.md.
3. Prove the guard passes and fails as intended, run the full check, then review for a smaller implementation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a focused repository guard that inspects Web map SVG append relationships. It requires the patterned field and moving camera to be root siblings and rejects the former camera.append(field, ...layers) topology with a repaint-specific error. Added the matching Web SVG performance rule to AGENTS.md.

Cold simplicity review: bun run check reaches the focused Bun test, which reads the Web map source, collects SVG append calls, and rejects any parent for field except root while also requiring field and camera as root siblings. A raw text match was shorter but less solid because formatting or nested calls could evade it. No production abstraction or dependency was added, and the two-test file remains easy to follow.

Verification: the guard passed the current root.append(field, camera) topology and rejected the exact former camera.append(field, ...Object.values(layers)) topology. Focused tests passed 2/2 and focused Biome lint passed. bun run check exited 0: TypeScript passed, 81 Node tests passed, and 187 Bun tests passed. Biome reported only the repository existing complexity warnings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prevented the known SVG camera repaint regression with a repository guard that rejects nesting the patterned field under the moving camera, and documented the Web SVG performance invariant and required frame-rate checks. The exact former topology is covered; bun run check passed with 81 Node and 187 Bun tests.
<!-- SECTION:FINAL_SUMMARY:END -->
