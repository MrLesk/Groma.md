---
id: TASK-308
title: Initialize Backlog.md from Groma init when the CLI is available
status: Done
assignee:
  - '@alex'
created_date: '2026-09-06 17:13'
updated_date: '2026-09-06 18:07'
labels: []
dependencies: []
references:
  - src/init-command.ts
  - README.md
  - init-command
  - project-initialization
  - web-server
modified_files:
  - src/init-command.ts
  - src/viewers/web/server.ts
  - test/init-ui-helpers.ts
  - test/initialize.test.ts
  - test/instructions.test.ts
  - test-bun/web-startup.test.ts
  - README.md
  - docs/index.md
type: feature
ordinal: 346000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma setup owns the repository initialization path. It initializes Git before writing Groma state, initializes Backlog.md when its CLI is available and the project is not yet initialized, and uses the same setup operation from groma init, interactive groma view, and the browser setup form. Existing Git and Backlog.md projects remain unchanged; optional Backlog.md installation and a declined setup still let Groma finish.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Interactive groma init detects an available Backlog.md CLI without an initialized project and initializes Backlog.md in the repository.
- [x] #2 An already initialized Backlog.md project is left unchanged and groma init does not run initialization again.
- [x] #3 Declining optional Backlog.md setup still allows Groma initialization to complete.
- [x] #4 Tests cover available and initialized, available and uninitialized, unavailable, and decline paths.
- [x] #5 README setup instructions use groma init as the Backlog.md initialization entry point.
- [x] #6 Git is initialized before Groma or Backlog setup when the repository has no Git metadata.
- [x] #7 groma init, interactive groma view first-run setup, and groma web browser setup use the same repository initialization operation.
- [x] #8 Non-interactive groma init with an explicit project name and directory initializes Backlog.md when the CLI is available and the project is not yet initialized.
- [x] #9 Backlog initialization spawned by Groma requests the AGENTS.md agent-instruction update.
- [x] #10 README and docs/index.md describe Git-first setup and that both interactive and non-interactive groma init initialize Backlog.md when the CLI is available.
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
1. Shared initializeRepository from groma init, interactive groma view first-run, and browser setup; Git first, then Groma, then Backlog when the CLI is available.
2. Non-interactive groma init uses that same Backlog setup and skips only the optional install prompt.
3. Spawn backlog init with --agent-instructions agents so AGENTS.md receives the Backlog.md CLI nudge.
4. Preserve existing Backlog projects; optional install/decline remains interactive-only.
5. Tests cover interactive and non-interactive Backlog paths; README and docs/index.md describe Git-first setup and both init forms.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity review found the shared flow clear and behaviorally complete. Removed the web server's broad InitCommandDependencies seam; it now accepts only RepositoryInitDependencies, keeping repository setup ownership explicit. RepositoryInitResult has no unused Git field in the current implementation. Preserved unrelated README work already present in the worktree.

Specification review: each acceptance criterion is covered by the shared initialization tests, first-run/browser tests, README setup text, and the full repository check.
Quality review: Git setup is the first side effect; Backlog detection preserves existing markers; the shared operation is used by terminal and browser entry points; the web seam is limited to RepositoryInitDependencies. No changed-file lint, type, test, or diff-check failures.
Validation: bun test --timeout 20000 test/initialize.test.ts test/first-run.test.ts test/instructions.test.ts (25 pass); bun test --timeout 20000 test-bun/web-startup.test.ts test-bun/web-first-run.test.ts (10 pass); bun run check (108 Node tests and 333 Bun tests pass; 6 existing Biome complexity warnings remain). Cold simplicity review found no blocking issue.

Reopened to initialize Backlog.md from non-interactive groma init, request Backlog's AGENTS.md nudge, and complete setup documentation. Git-first order stays; cancelling the wizard may leave .git.

Non-interactive groma init now runs the shared Backlog setup. backlog init is spawned with --agent-instructions agents. README and docs/index.md describe Git-first setup and both init forms.

Correction review: non-interactive init now calls initializeAvailableBacklog. Instruction spawn tests still pass with backlog on PATH and require the Backlog AGENTS.md nudge when a Backlog folder is created. bun run check: 109 Node tests and 340 Bun tests pass; 6 existing Biome complexity warnings remain; git diff --check is clean. Specification: AC8 non-interactive stub calls initializeBacklog once without ask:backlog; AC9 spawn includes --agent-instructions agents and the instruction test matches BACKLOG.MD GUIDELINES START when Backlog files appear; AC10 README and docs/index.md describe Git-first and both init forms. Quality: setupBacklog skip removed; no Git rollback on cancel by decision; instruction listings no longer assume an exact root.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shared repository initialization now runs for interactive and non-interactive groma init, groma view first-run, and browser setup. Git is first; available Backlog.md is initialized once with --agent-instructions agents; existing projects are preserved; optional install remains interactive. README and docs/index.md describe both forms. Verified with 26 focused init/instruction tests, bun run check (109 Node + 340 Bun passing), and git diff --check.
<!-- SECTION:FINAL_SUMMARY:END -->
