---
id: TASK-284
title: Update dependencies for Bun 1.4.1 and resolve the startup test failure
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 21:05'
updated_date: '2026-09-05 21:22'
labels: []
dependencies: []
references:
  - architecture-reader
  - authoring
  - architecture-writer
  - project-profile
  - project-editor
  - backlog-plugin
  - scan-lifecycle
  - groma-filesystem
  - architecture-watch
  - terminal-host
  - session
  - export
modified_files:
  - AGENTS.md
  - package.json
  - plugins/work-sources/backlog/package.json
  - CONTRIBUTING.md
  - bun.lock
  - plugins/work-sources/backlog/src/index.ts
  - src/architecture-reader.ts
  - src/flow-authoring.ts
  - src/markdown-emitter.ts
  - src/project-profile.ts
  - src/project-markdown.ts
  - src/viewers/web/project/editor.ts
  - test-bun/flows.test.ts
  - biome.json
  - src/scanner.ts
  - src/architecture-watch.ts
  - src/groma-filesystem.ts
  - src/view-host.ts
  - src/viewers/web/map-session.ts
  - src/viewers/web/export.ts
  - docs/scanners/index.md
type: chore
ordinal: 323000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Align the declared Bun toolchain with 1.4.1, update external dependencies in project and workspace manifests to their latest available releases, add the approved test-runner guidance, and investigate and resolve the empty-project live-scan failure seen with isolated parallel test workers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bun is declared as 1.4.1 and external project dependencies are updated consistently with the lockfile, with any version exceptions explained.
- [x] #2 AGENTS.md contains the approved concise test-runner validation rules.
- [x] #3 The empty-project live-scan failure has a demonstrated cause and a scoped correction, with regression evidence under isolated parallel execution.
- [x] #4 The required repository check passes after the complete update.
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
Inspect manifest versions and the startup/watch lifecycle. Add the approved guidance and update manifests one file at a time with immediate tracking, then regenerate the lockfile. Reproduce and diagnose the startup failure without weakening its scenario; apply the smallest supported fix and regression coverage. Run focused parallel checks and bun run check, perform specification and quality reviews, and obtain the requested full-context complexity review before finalizing.

Use @parcel/watcher subscriptions for source and architecture watching and await registration before returning ready viewers. Keep current scan/reload ownership and settling behavior; normalize paths from the native watcher relative to its real root. Remove obsolete watcher directory discovery and mtime filtering. Verify the existing empty-project and architecture-change scenarios repeatedly, then run the full repository check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Resolved external dependency targets from the npm registry on 2026-09-05. Updated Bun metadata and types to 1.4.1, Comark/html to 0.6.2, OpenTUI to 0.5.10, Biome to 2.5.12, Node types to 26.4.1, tsx to 4.23.13, and TypeScript on its existing next channel to 7.1.0-dev.20260905.1. Updated direct Comark parse/render API names; no model semantics changed. The approved AGENTS section was added while preserving pre-existing edits. Watcher investigation: parallel diagnostics reproduced missing live updates. Temporary traces showed no filesystem event for the failed write. Standalone fs.watch probes outside Groma missed immediate writes under Bun 1.4.1 and Node 24.13 on macOS; yielding one event-loop turn or delaying 10 ms did not eliminate loss. Diagnostics removed. Required check: typecheck/lint and all 102 Node tests pass; Bun has 285 passes and one missing architecture-change event failure. No assertions or timeouts were weakened. User decision requested before replacing filesystem watchers with a readiness-aware API.

Alex approved replacing watcher setup if Windows-compatible. @parcel/watcher 2.6.0 documents Windows ReadDirectoryChangesW support and ships x64/ARM64 binaries. A 100-case immediate-write readiness probe under Bun 1.4.1 passed with zero missed writes after awaited subscribe; event paths are canonical real paths on macOS. Chokidar readiness did not eliminate the loss in the same probe, so Parcel is selected. No Windows machine is available locally; compatibility evidence is upstream platform support, not a local Windows test.

The readiness fix replaces raw source and architecture watchers with awaited @parcel/watcher 2.6.0 subscriptions. Existing scan/reload settling and ownership remain; canonical native event paths are converted relative to the real watched root. Removed manual recursive watcher management and obsolete mtime filtering (31 added / 87 removed lines across six watcher/startup files). Verification: bun run check passed all 102 Node and 286 Bun tests; three isolated parallel repetitions passed 858/858 with seed 141. Focused startup/live tests passed 42/42 across three repetitions. No test assertion, scenario or timeout was weakened. TUI walkthrough verified an architecture edit arrives without refresh, container opening, resizing to 200x60 and exit; SVG captures are in /tmp/groma284-tui-*.svg. git diff --check passes and all changed source/test files remain below 500 lines. Specification review: all requested dependency, guidance and supported live-update outcomes verified. Quality review: no blocking defect, no new domain abstraction, no compatibility layer; remaining lint complexity warnings are in existing function bodies, including another task. Windows support is documented by upstream and Windows binaries are present in lockfile; local verification was macOS only. Requested full-context complexity review follows.

Full-context complexity review found no blockers or material follow-up recommendations. It confirmed that awaited subscriptions fix the reproduced readiness failure with fewer lines, preserve scanner/filesystem/viewer ownership, and require no shared watcher framework. Windows remains an upstream-supported platform that was not locally tested.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated Bun to 1.4.1, refreshed external dependencies and the lockfile, adapted renamed Comark APIs, and added concise test-runner guidance. Replaced source and architecture fs.watch setup with awaited @parcel/watcher subscriptions, removing manual directory tracking and mtime filtering. The first live edit is observed without weakening tests. bun run check passed 388 tests; three isolated parallel Bun repetitions passed 858 tests. TUI live updates, container navigation and resize were verified. Windows x64/ARM64 support is documented by the dependency; local testing was macOS. Specification, quality and full-context complexity reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
