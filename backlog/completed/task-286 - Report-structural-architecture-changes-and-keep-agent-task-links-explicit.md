---
id: TASK-286
title: Report structural architecture changes and keep agent task links explicit
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 21:52'
updated_date: '2026-09-05 22:01'
labels: []
dependencies: []
references:
  - observed-curation
  - agent-instructions
  - authoring
  - edit
  - web-server
  - commands
modified_files:
  - src/curate.ts
  - src/group.ts
  - src/add.ts
  - src/edit.ts
  - src/remove.ts
  - src/viewers/web/map-session.ts
  - src/cli.ts
  - src/agent-instructions.ts
  - docs/agent-instructions/index.md
  - test-bun/structural-results.test.ts
  - test/initialize.test.ts
  - test-bun/web-authoring.test.ts
type: feature
ordinal: 325000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After a supported structural curation command, agents need its created, changed and removed architecture paths, affected element IDs, and absorbed-to-surviving ID mappings. Expose those existing operation facts so the agent can keep its active Backlog task linked correctly. Clarify the managed Groma nudge and curation guide: exact Groma IDs belong in Backlog references, and task edits go through the Backlog CLI. Preview and individual-file ownership transfer are excluded.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Successful structural curation commands report created, changed and removed repository-relative architecture paths and affected element IDs.
- [x] #2 A combine reports every absorbed element ID and its surviving ID; moves distinguish changed ownership paths without inventing ID replacements.
- [x] #3 Results derive from the executed structural operation and introduce no saved operation history, ID aliases, preview, or code-transfer behavior.
- [x] #4 The managed nudge explicitly tells agents to add exact affected groma.id values to the active Backlog task references through backlog task edit --add-ref, and record changed files immediately.
- [x] #5 The guide explains updating task links immediately after a multi-file structural command, preserving the full modified-file list and replacing absorbed references through Backlog CLI commands.
- [x] #6 Existing initialization refreshes the nudge; Groma itself never writes Backlog tasks.
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
1. Return structural results from the existing curate rewrite/removal and group member operations, including repository-relative paths, affected IDs and absorbed-to-surviving mappings only after successful execution. 2. Pass the result through shared authoring and browser responses; print readable CLI results while preserving ordinary write IDs. 3. Update the managed nudge through its existing init registration and extend the existing agent guide with immediate multi-file Backlog tracking and reference replacement. 4. Verify component/container combine, move, groups, failures and init refresh; run focused checks, one cold simplicity review, self specification/quality reviews and bun run check. OKF and C4: these are transient operation facts about existing documents/elements, not new stored concepts or map boxes. Ordinary readers retain the same Markdown; Groma authoring owns execution results and agents own Backlog task links.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented structural results from executed rewrites/removals and group writes. The changed list includes existing documents rewritten even when bytes are unchanged (for example a container combine survivor). Shared web responses retain a string id and expose the same result fields; CLI prints readable path/ID/replacement lines. Managed nudge and guide specify immediate Backlog CLI updates, complete modified-file preservation and absorbed reference replacement. Focused structural/browser tests: 11 pass; Biome on 11 changed TypeScript files and typecheck pass. Initial web test attempt was sandbox-blocked at listen; rerun with local server permission passed. Fixture mistakes were corrected (component-only code metadata and annotated parent field). Full repository check is coordinated by root after parallel changes settle.

Cold simplicity review passed with no blocking findings; accepted its two comments clarifying rewritten-but-identical paths and web response facts. Self specification review: AC1-2 verified by structural filesystem comparison tests, component/container mappings, CLI move and manual CLI combine output, and web move/group responses. AC3 confirmed by direct operation result construction with no persistence or scanner/source transfer changes. AC4-5 verified against the managed nudge and guide examples for exact IDs, immediate full file-list tracking and add-ref/remove-ref. AC6 verified by init refresh/current registration equivalence and repeated-init preservation test; Groma code does not update Backlog. Self quality review found no reproducible defects or authority-backed blockers. Node curation/group/init tests: 18 pass. Shared-file ownership: src/cli.ts TASK-286 owns result type import, printWriteResult helper and draft/add/remove/edit output callsites; TASK-285 owns exact record output and view-help hunks. test-bun/web-authoring.test.ts TASK-286 owns only move/group result response assertions; TASK-285 owns readFile import and raw-source assertion. No Groma-owned architecture files were edited by this task. Full repository check, full-context review and task finalization remain with coordinator.

Coordinator final bun run check passed after parallel implementations settled: 106 Node tests and 293 Bun tests, zero failures; seven pre-existing complexity warnings in untouched files and no new warnings. The only post-focused-test changes accepted from simplicity review were comments, with no executable changes.

Final full-context complexity review passed with no material recommendations or blocking concerns. Curation and groups own executed operation facts, CLI and Web present the same result, and agents own Backlog writes. Final bun run check passed 106 Node and 293 Bun tests with zero failures; lint and typecheck completed with seven existing warnings outside the changed files. No scanner, stored knowledge model or code-ownership behavior changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Structural curation and group commands report executed architecture paths, affected element IDs and combine replacements through CLI and Web. The managed agent nudge and guide now require immediate file tracking and exact Groma references through Backlog CLI. Verified with filesystem-difference tests, CLI output, Web authoring, initialization refresh and the full 399-test repository check. Cold simplicity, specification, quality and final full-context complexity reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
