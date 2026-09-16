---
id: TASK-228.4
title: Embed Backlog as a work-source plugin
status: Done
assignee:
  - '@codex'
created_date: '2026-09-01 17:37'
updated_date: '2026-09-01 18:03'
labels: []
dependencies: []
references:
  - backlog-plugin
  - view-host
  - welcome
  - work-source-contract
  - terminal-host
  - web-server
  - export
modified_files:
  - packages/work-source/package.json
  - packages/work-source/src/index.ts
  - plugins/work-sources/backlog/package.json
  - plugins/work-sources/backlog/src/index.ts
  - package.json
  - src/types.ts
  - src/view-host.ts
  - src/viewers/web/server.ts
  - src/viewers/web/export.ts
  - src/welcome/model.ts
  - src/welcome/view.ts
  - bun.lock
  - test-bun/work.test.ts
  - test-bun/viewer-live.test.ts
  - test-bun/viewer-lifecycle.test.ts
  - test-bun/okf-profile-view.test.ts
  - test-bun/web-live.test.ts
  - test-bun/web-export.test.ts
  - test-bun/web-task-live.test.ts
  - src/work/backlog.ts
  - test-bun/welcome.test.ts
  - test/instructions.test.ts
  - README.md
  - docs/viewers/creating-a-plugin.md
  - docs/scanners/index.md
  - docs/product-model.md
  - docs/viewers/index.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/work-source-contract.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/backlog-plugin.md
  - groma/observed/systems/groma/containers/cli/components/welcome.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/terminal-host.md
  - groma/observed/systems/groma/containers/web-viewer/components/web-server.md
  - groma/observed/systems/groma/containers/web-viewer/components/export.md
parent_task_id: TASK-228
priority: high
type: enhancement
ordinal: 250000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma embeds Backlog as an official work-source plugin with a public contract, while the TUI, Web viewer, and export remain fully usable when the global Backlog.md CLI is absent. The Welcome derives Backlog readiness from the embedded plugin instead of hardcoding it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The official Backlog work source lives under plugins/work-sources/backlog and implements a public @groma/work-source contract while remaining embedded in Groma.
- [x] #2 Terminal, Web, and export hosts consume Backlog through the work-source contract and preserve current task, detail, watch, and pin behavior when the Backlog.md CLI is available.
- [x] #3 When the global backlog command is absent, groma view, groma web, and groma export still open or complete with empty work instead of failing.
- [x] #4 The Welcome derives Backlog readiness from the embedded plugin and reports backlog.md: missing with bun i -g backlog.md for the current Bun distribution, or backlog.md: found when available.
- [x] #5 The TypeScript scanner remains built-in and scanner modules keep their separate scanner contract.
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
1. Extract work DTOs, the WorkSource lifecycle, empty source, and embedded plugin readiness into @groma/work-source.
2. Move the Backlog command adapter to plugins/work-sources/backlog as @groma/work-source-backlog, retaining an injectable command runner for tests.
3. Route terminal, Web, and export defaults through the embedded plugin; a missing global backlog command returns empty work and never blocks architecture.
4. Derive the Welcome row from Backlog plugin readiness plus scanner inventory, showing the current Bun install command only when Backlog.md is missing.
5. Update workspace packaging, focused tests, public docs, and observed architecture; run focused/full checks and required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the public @groma/work-source contract and embedded @groma/work-source-backlog package. Terminal, Web, and export defaults use the plugin; missing global backlog supplies empty work. Welcome readiness is derived and shows the Bun install command. Focused missing-tool tests pass for all three delivery paths.

Full check exposed Bun-only command discovery in the public package. Replaced Bun.which with a Node filesystem PATH lookup that does not execute Backlog; 9 Node CLI/plain tests and 28 focused plugin/viewer tests now pass.

Cold simplicity review passed with no blocking findings. Removed the unused WorkSourceStatus alias and a redundant terminal-frame assertion. Kept export-only Backlog-directory detection in the export host because moving it into the plugin would change terminal and Web behavior beyond the approved missing-command scope. Type checking, git diff checks, and the focused missing-tool/plugin/export/Welcome tests pass after simplification.

Repository-wide checks reach 92/94 Node tests and 210/224 Bun tests on this shared host. The remaining failures are operating-system resource exhaustion: fs.watch returns EMFILE and Bun.serve cannot allocate port 0 (EADDRINUSE). The same watcher/port condition affected the previous task; direct task flows passed before the host exhausted these resources, and non-resource focused checks remain green.

Quality review found one public-doc mismatch: later Backlog read failures do not always replace existing terminal work with empty work. Corrected docs/viewers/index.md to state only the missing-CLI path supplies empty work, while any read failure leaves the map available.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Embedded Backlog as the official @groma/work-source-backlog package behind the public @groma/work-source contract. Terminal, Web, and export now consume the shared contract; missing global Backlog.md produces empty work, and Welcome shows plugin readiness with the Bun install command. Verified with type checking, Node CLI tests, focused Backlog/terminal/Web/export/Welcome tests, an actual PATH-without-Backlog Welcome run, diff checks, and cold simplicity, specification, quality, and full-context complexity reviews. Repository-wide watch and Web-server tests remain limited on this shared host by the recorded EMFILE/EADDRINUSE resource exhaustion.
<!-- SECTION:FINAL_SUMMARY:END -->
