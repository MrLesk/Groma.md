---
id: TASK-287
title: Read Backlog work exclusively through its public CLI
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 21:52'
updated_date: '2026-09-05 22:06'
labels: []
dependencies: []
references:
  - backlog-plugin
  - work-source-contract
  - export
  - backlog-md
modified_files:
  - plugins/work-sources/backlog/src/index.ts
  - plugins/work-sources/backlog/package.json
  - bun.lock
  - test-bun/work.test.ts
  - test-bun/web-export.test.ts
  - groma/externals/backlog-md.md
  - groma/systems/groma/containers/view-host/components/backlog-plugin.md
  - test-bun/backlog-command.test.ts
type: bug
ordinal: 326000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Groma Backlog adapter currently parses task Markdown directly and includes explanatory README files as empty task records, which breaks export. Replace duplicated task parsing with the public Backlog task list and task view JSON commands. Keep task ownership and writes in Backlog. Represent the actual integration as an external Backlog.md system related to the Groma Backlog plugin.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Work summaries come from backlog task list --json, with configured workflow statuses and default status read through Backlog CLI.
- [x] #2 Selected task details come from backlog task view <id> --json; the adapter does not parse task Markdown or infer task identity from filenames.
- [x] #3 A tasks directory containing explanatory README Markdown yields only real tasks and can be exported without an empty-ID task lookup.
- [x] #4 Groma invokes only read operations on Backlog CLI and never writes tasks; existing missing-CLI behavior and work-source contract remain supported.
- [x] #5 Groma architecture contains Backlog.md as an external system and a directed relationship from its Backlog plugin describing read-only CLI access.
- [x] #6 Documentation and adapter tests match the implemented CLI boundary; obsolete Markdown parsing is removed.
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
1. Replace task Markdown parsing with task list --json summaries and task view <id> --json details; preserve config reads, watcher, missing-CLI behavior, and WorkSource shape.
2. Remove the plugin Markdown dependency and test the CLI read boundary, optional detail fields, README exclusion, and export.
3. Add Backlog.md as an external C4 system with a directed read-only CLI relationship from backlog-plugin through Groma commands.
4. Run focused tests and bun run check; verify the live Backlog repository with read-only calls and review task scope and quality.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced all task-directory enumeration, filename-based lookup, frontmatter parsing, and Markdown section parsing with public task list --json and task view <id> --json reads. Workflow config reads, watcher delivery, missing-CLI behavior, and WorkSource shape are preserved; nullable JSON fields map to existing empty-string values. Removed the unused plugin comark dependency and regenerated bun.lock without changing root package.json.
Focused validation: bun test --timeout 20000 test-bun/work.test.ts test-bun/web-export.test.ts passed 22/22 with filesystem watching available. Initial sandbox run failed existing FSEvents watcher flows; the same unchanged suite passed with escalation. Scoped Biome lint and git diff --check passed. Read-only real /Users/alex/projects/Backlog.md proof returned 82 task IDs exactly matching backlog task list --json, zero empty IDs, and successful BACK-200 detail read. Export regression covers explanatory README storage and only valid CLI task detail lookups.
Self simplicity and quality review: direct field mapping replaces parser helpers; no new dependency, fallback, retry, write command, schema migration, scanner change, or WorkSource API change. Specification evidence supports criteria 1-4 and 6. Added external backlog-md and directed backlog-plugin read-only CLI relation through Groma commands before the coordinator relayed a new lifecycle clarification; architecture changes are held untouched pending that decision, so criterion 5 is not finalized. Coordinator will run the full repository check after concurrent changes settle.

Integrated origin/main TASK-284 Windows command fix after the shared-main merge. Restored the CLI-only adapter while preserving runBacklog byte-for-byte apart from removing its obsolete config-only comment. Updated backlog-command.test.ts to prove CLI reads do not need a local task directory and to exercise task list/view JSON through the Windows .cmd shim with a spaced command path. No architecture files were changed during integration.
Integration-focused validation: bun test --timeout 20000 test-bun/backlog-command.test.ts test-bun/work.test.ts test-bun/web-export.test.ts reported 24 passed, zero failed on macOS; the Windows-only test returns early on macOS, so cmd.exe execution remains unverified here. Scoped Biome and diff whitespace checks passed. Targeted self specification and quality review found no integration blockers: public read commands and unchanged WorkSource behavior coexist with the merged Windows launcher; no parser or filesystem read precondition remains. Full repository check and targeted full-context review are delegated to the coordinator.

Full-context complexity review passed with no blockers or material recommendations. After merging remote Windows fix f12190f, retained its .cmd launcher and restored CLI-only task reads; updated imported command tests to cover CLI authority without local task storage and summaries/details via the Windows shim. Focused integration suite reported 24 passes; the Windows-only branch was not executed on macOS. Targeted self and full-context re-reviews passed. The first complete repository check passed 106 Node and 293 Bun tests before remote integration. The required rerun after integration reached typecheck and was blocked by concurrent, unrelated flow-selection edits (WebFlowRef array changes and ViewState.flow to flows in web-flow-activation/web-url tests). No files from that work were changed. Criterion 5 and task finalization remain pending the user decision on whether manually declared actors/externals must be drafts; the new external and relationship are held uncommitted.

User clarified that the draft rule applies only to scanner-managed kinds. Manually declared actors and external systems remain stable, so the existing stable backlog-md external and directed backlog-plugin relationship are approved. Read-only groma view backlog-md and groma view backlog-plugin both succeeded through architecture validation and showed the complete external record and read-only CLI relationship. No scanner or draft behavior changes were required.

Final repository check after the user clarification and remote integration passed: lint and typecheck completed, 106 Node tests and 301 Bun tests passed with zero failures. Seven existing complexity warnings remain outside this task. The Windows-only command test returns early on macOS, so native Windows execution remains unverified here. All acceptance criteria now have objective evidence. Specification, quality, full-context complexity and targeted integration reviews passed; task changes remain isolated from concurrent flow work.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Backlog summaries, selected task details and workflow settings now come exclusively from the public Backlog CLI. Removed duplicate Markdown parsing and its plugin dependency, fixed README files appearing as empty tasks during export, and recorded Backlog.md as a stable external system with directed read-only CLI access. Preserved the merged Windows launcher. Verified with CLI-boundary and export tests, 82 real Backlog task IDs, architecture reads and the full 407-test repository check; native Windows execution was not available on macOS.
<!-- SECTION:FINAL_SUMMARY:END -->
