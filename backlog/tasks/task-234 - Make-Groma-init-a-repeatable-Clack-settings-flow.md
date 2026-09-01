---
id: TASK-234
title: Make Groma init a repeatable Clack settings flow
status: Done
assignee:
  - '@codex'
created_date: '2026-09-01 20:17'
updated_date: '2026-09-01 20:54'
labels: []
dependencies: []
references:
  - project-initialization
  - commands
  - init-command
modified_files:
  - package.json
  - bun.lock
  - src/initialize.ts
  - src/init-command.ts
  - src/cli.ts
  - test/initialize.test.ts
  - src/brand.ts
  - src/viewers/web/atoms/theme.ts
  - src/init-command-ui.ts
  - >-
    groma/observed/systems/groma/containers/cli/components/project-initialization.md
  - groma/observed/systems/groma/containers/cli/components/init-command.md
  - groma/observed/systems/groma/containers/cli/components/commands.md
  - docs/index.md
  - test/instructions.test.ts
ordinal: 256000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer runs groma init, Groma presents a clear initialization or settings flow instead of printing a bare ok. New repositories choose their project identity and storage root. Existing repositories load the current identity and fixed storage root, allow the project name to change, summarize the saved settings, and refresh the managed agent nudge. A new or component-empty architecture then offers a guided first scan and a choice to open the browser map, terminal map, or finish.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Interactive first-time initialization uses Clack to ask for the project name and select groma/ or .groma/, with groma/ recommended by default
- [x] #2 Successful initialization shows a Clack summary and a clear initialized-project outro instead of printing a bare ok
- [x] #3 Re-running init loads the current project title, offers it for editing, reuses and displays the fixed existing storage root as the Groma folder, and saves a changed title
- [x] #4 Every init run replaces any existing managed Groma agent block with the current canonical nudge while preserving content outside the managed block
- [x] #5 Non-interactive initialization keeps explicit project-name and directory inputs and prints a readable result without interactive prompts
- [x] #6 Tests cover first initialization, re-initialization with and without a title change, canonical nudge refresh, cancellation, and non-interactive behavior
- [x] #7 Interactive init offers a first scan only for a first initialization or an architecture with no observed components; an existing architecture with components closes after its settings summary
- [x] #8 After an accepted first scan, Groma shows the scan summary and offers to open the browser map, open the terminal map, or finish
- [x] #9 The view choice launches the selected Groma viewer without an unnecessary second scan and tells users that groma web and groma view can be run again later
- [x] #10 When the backlog command is unavailable during interactive init, Groma offers to install Backlog.md using the installer inferred from Groma's executable path, asks for the installer only when inference is unclear, and never installs in non-interactive mode
- [x] #11 Declining or failing the optional Backlog.md installation does not undo Groma initialization; failure reports the attempted command before onboarding continues
- [x] #12 Interactive Clack controls use Groma's light/dark accent treatment, choosing the readable accent for the detected terminal background
- [x] #13 Accepting the existing project name leaves project.md unchanged and reports unchanged settings instead of claiming an update
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
1. Use Clack prompts and a Groma-themed Clack UI layer for project identity, storage selection, cancellation, summaries, and completion.
2. Let initializeGroma load and save the existing project profile, keep the selected storage root, create the minimum package, and reconcile the canonical agent nudge on every run.
3. During interactive init, detect whether Backlog.md is installed; if absent, offer installation using Groma install-path inference for Bun, npm, or Homebrew and ask only when inference is unclear.
4. In the interactive command only, detect observed components; offer one first scan for new or component-empty architecture, show its result, and hand off to the selected viewer without a second scan.
5. Preserve explicit non-interactive project-name and directory inputs with readable output, no prompts, no package installation, and no automatic scan.
6. Test initialization state and lifecycle rules without decorative UI or prose assertions; verify the interactive Clack presentation through manual TTY QA.
7. Share the Groma light/dark accent constants with the web palette, update the public init contract and observed architecture, then run focused checks and bun run check.

8. Represent initialization outcome as initialized, updated, or unchanged so completion copy and writes cannot disagree.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the repeatable init/settings flow with Clack prompts 1.7.0 and Clack core 1.4.3, editable project identity, fixed root reuse, managed nudge refresh, optional Backlog.md installation, first-scan onboarding, and no-rescan viewer handoff. Added a shared Groma brand palette and a themed Clack renderer that selects #147A59 on light terminal backgrounds and #1D9E75 on dark backgrounds; the web palette uses the same constants.

Manual TTY QA verified first init, storage selection, settings and reminder notes, scan decline, completion output, re-init, and accepting the displayed project title with Enter. Focused lint, typecheck, git diff checks, and 25 init/instruction tests pass. The full check reaches all 110 Node tests and fails only in the two existing scan-watch cases because this host cannot open additional watchers (EMFILE); TASK-234 focused tests pass.

The cold simplicity review found that component eligibility did not belong in core initialization. The accepted fix moved that read into the interactive init command after the non-interactive return and removed the unused result field and test support. Its targeted re-review passed. Decorative theme and exact-output assertions added during this task were removed; automated coverage retains initialization state and lifecycle rules.

Final manual TTY QA verified the accepted first scan, scan counts, all three viewer choices, the Groma folder label, same-name Enter behavior, and unchanged completion. The full-context complexity review passed after adding the unchanged-state business test and correcting the Backlog.md documentation scope.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the bare init result with a repeatable Groma-themed Clack setup and settings flow. Initialization now preserves the selected root, distinguishes initialized/updated/unchanged state, refreshes the managed nudge, optionally installs Backlog.md, guides the first scan, and opens a selected viewer without rescanning. Verified with manual first-init and re-init TTY runs, focused lint and typecheck, 25 init/instruction tests, git diff checks, cold simplicity review, and full-context complexity review; the full repository check remains limited only by the two existing EMFILE scan-watch failures.
<!-- SECTION:FINAL_SUMMARY:END -->
