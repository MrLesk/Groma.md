---
id: TASK-354
title: Separate export updates from source scanning and Backlog storage
status: Done
assignee:
  - '@codex'
created_date: '2026-09-11 15:00'
updated_date: '2026-09-11 15:03'
labels: []
dependencies: []
references:
  - export
  - backlog-plugin
  - commands
  - init-command
  - welcome
modified_files:
  - src/viewers/web/export.ts
  - plugins/work-sources/backlog/src/index.ts
  - src/cli.ts
  - src/init-command.ts
  - src/welcome/model.ts
  - README.md
  - docs/viewers/web/index.md
  - docs/product-model.md
  - docs/viewers/creating-a-plugin.md
  - groma/systems/groma/containers/web-viewer/components/export.md
  - groma/systems/groma/containers/view-host/components/backlog-plugin.md
type: enhancement
ordinal: 400000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Export publishes stored architecture without starting a source scan or source watcher. Its optional continuous export follows architecture changes through the existing architecture watcher. Backlog integration uses only the public CLI for project detection and task reads; filesystem task notifications are disabled until the CLI provides watch support. Keep existing source inspection in exported snapshots. No storage plugin framework or server is added.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Export and export --watch never start source scanning; architecture changes still refresh watched static output.
- [x] #2 Backlog task reads and initialization detection use the CLI without inspecting or watching Backlog storage paths; automatic Backlog task notifications are disabled.
- [x] #3 CLI help and current product documentation explain separate scanning, continuous local export, and the temporary Backlog notification limitation.
- [x] #4 Repository checks pass and a disposable export exercise verifies source edits alone do not refresh output while architecture edits do.
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
1. Remove scanner startup and source-watch wiring from export while retaining architecture watching and static delivery. 2. Remove Backlog storage checks and filesystem watching; reuse CLI project detection and existing empty-work behavior. 3. Update current docs and affected architecture descriptions through Groma. 4. Exercise the supported export path on a disposable fixture, run bun run check, and review the scoped diff.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented by removing source scanning from export startup and source-watch subscription from the exporter. Architecture watching stays behind watchArchitecture; existing work-source notifications remain in the contract, with the Backlog implementation disabled until CLI watch support. Replaced Backlog storage detection with CLI config get projectName and executable lookup with the existing Bun.which pattern. Export uses the same optional empty-work read behavior as the live web host, preserving export without initialized Backlog. Updated current docs, command help, and two component descriptions through Groma. No storage abstraction, server, polling replacement, or automated plumbing test was added.

Verification: disposable plain-view fixture exercised the real one-shot and watched export CLI. One-shot export preserved architecture without initialized Backlog; a TypeScript edit changed neither architecture nor snapshot; a Groma project edit refreshed output and copied current source. Custom Backlog storage under work-items passed CLI project detection, task list/detail reads, export inclusion, and a subsequent CLI task edit emitted no watch notification but appeared on a new read. Evidence scripts: /tmp/groma-task-354-exercise.ts and /tmp/groma-task-354-backlog.ts. bun run check passed: 16 Node and 256 Bun tests, six unavailable Rust/Go toolchain skips, no failures or lint warnings. git diff --check passed; export --help verified.

Implementer simplicity, specification and quality review: this bounded delivery cleanup removes wiring and filesystem assumptions without changing domain algorithms or adding concepts. Export consumes persisted OKF architecture through existing readers/watchers; the scanner adapter owns source observation and reconciliation; Backlog owns storage behind its CLI. No new C4 element or OKF metadata is needed. This ownership applies independently of project language or future storage choice. All four acceptance criteria and Definition of Done items have recorded evidence; no blocking defect found in the supported flow.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Export now publishes stored architecture without scanning source and watches architecture updates only, plus the existing work-source notification contract. Removed Backlog storage checks and filesystem task watching; CLI reads work with custom storage, and notifications remain disabled pending CLI watch support. Updated help and documentation. Disposable CLI exercises passed; repository check passed with 16 Node and 256 Bun tests, six toolchain skips. Changes remain uncommitted pending user confirmation.
<!-- SECTION:FINAL_SUMMARY:END -->
