---
id: TASK-227
title: Add advanced commands accordion to the Groma splash screen
status: Done
assignee:
  - '@codex'
created_date: '2026-08-31 17:51'
updated_date: '2026-08-31 18:13'
labels: []
dependencies: []
references:
  - welcome
modified_files:
  - src/welcome.ts
  - test-bun/welcome.test.ts
  - README.md
  - docs/product-model.md
  - groma/observed/systems/groma/containers/cli/components/welcome.md
ordinal: 243000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Architects opening the bare Groma terminal launcher can keep the primary getting-started actions concise, then expand one Advanced commands section for less common CLI workflows. The expanded section includes static Web export and reuses Welcome command presentation instead of adding a separate help surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bare interactive `groma` shows one collapsed Advanced commands row after the existing executable actions.
- [x] #2 Enter on Advanced commands expands or collapses read-only command rows, including `groma export <directory> [--watch]`, with clear required and optional parameter notation.
- [x] #3 Expanded command rows are not navigation targets, never receive the blinking indicator, and cannot dispatch a command.
- [x] #4 Up and Down navigation, primary action dispatch, quit behavior, renderer cleanup, and non-interactive output remain correct; plain output includes the advanced reference without interaction.
- [x] #5 Product documentation and observed architecture describe the final executable and read-only command grouping.
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
1. Keep executable launcher actions and read-only command references as separate Welcome-owned data, with one selectable Advanced commands toggle.
2. Make Enter toggle the section while Up and Down continue to visit only executable actions and the toggle; expanded command rows never blink or dispatch.
3. Render the same advanced syntax and parameter notes in the expanded terminal sheet and always-expanded plain output, including groma export <directory> [--watch].
4. Cover navigation, toggle, non-dispatch, and cleanup behavior; update product documentation and the observed Welcome component through Groma.
5. Run focused checks, terminal-frame verification, the repository check, cold simplicity review, and the required full-context complexity review before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Architecture decision: Advanced commands are read-only references, not another launcher. Welcome keeps executable actions and reference commands in separate lists. Up and Down can select only the existing actions and the accordion header; Enter on the header toggles one boolean and never returns a WelcomeActionId.

Parameter syntax uses angle brackets for required values, square brackets for optional values, and an ellipsis for further options. The list includes groma export <directory> [--watch], create, edit, relate, accept, and instructions. Non-interactive output shows the same references expanded.

Verification:
- Focused Biome lint and TypeScript pass.
- Six Welcome interaction/lifecycle tests and six CLI/plain-output tests pass.
- git diff --check passes; src/welcome.ts is 491 lines.
- A scripted 80x45 OpenTUI frame proves both borders fit, the export syntax and parameter notes are visible, and expanded reference rows have no selection marker.
- A real PTY exposed an initial 80-column clipping regression. Command and parameter descriptions were shortened instead of adding responsive layout logic; the corrected 80-column frame fits completely.
- bun run check passes lint and TypeScript and reaches 89 of 91 Node tests. Only the existing host watcher failures remain: EMFILE in watchScan and the dependent scan --watch test receives no output.

Cold simplicity review passed. It found the flow already minimal: one advanced list, one expansion boolean, and the existing selected index and action-return boundary. Its optional naming clarification was accepted by naming advanced-list callbacks command instead of action.

Specification and quality reviews passed all five acceptance criteria with no blocking implementation finding. The quality reviewer noted that the interaction test does not assert rendered command copy; this remains intentionally covered by scripted frame evidence because repository tests do not assert UI prose.

The required full-context complexity review recommends keeping the architecture. Executable actions alone define WelcomeActionId, while advanced references are separate data projected with selected false. Navigation clamps before them and Enter on the header returns before dispatch. The reviewer found no simpler or safer approach, no domain-grouping problem, and no junior-safety finding.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a collapsed Advanced commands accordion to the bare Groma terminal launcher. Enter expands six read-only command references, including groma export <directory> [--watch], with required and optional parameter notation; the references never receive selection, blinking, or dispatch behavior. Plain output includes the same references. Focused lint, TypeScript, 12 tests, diff checks, 80-column frame verification, and specification, quality, simplicity, and full-context architecture reviews pass. The full repository check remains limited only by the host's two existing filesystem-watch failures.
<!-- SECTION:FINAL_SUMMARY:END -->
