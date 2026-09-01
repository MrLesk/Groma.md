---
id: TASK-232
title: Make Groma viewers work on Windows
status: Done
assignee: []
created_date: '2026-09-01 18:25'
updated_date: '2026-09-01 20:10'
labels: []
dependencies: []
references:
  - sheet-routing
  - architecture-writer
  - web-server
  - web-shell
  - revision-history
  - c-scanner
  - architecture-watch
  - scan-lifecycle
  - export
  - commands
  - terminal-host
  - world-layout
  - create
  - instructions
  - scanner-modules
  - cli-agent-instructions
  - naming
  - work-source
  - welcome
  - architecture-comparison
  - edit
  - observed-curation
  - project-initialization
  - accept
  - architecture-model
  - architecture-reader
  - groma-filesystem
  - project-profile
modified_files:
  - test-bun/sheet-route.test.ts
  - src/sheet/route-geometry.ts
  - src/sheet/route.ts
  - test-bun/okf-writers.test.ts
  - src/markdown-emitter.ts
  - src/viewers/web/runtime.ts
  - scripts/lint-web-scrollbars.ts
  - src/history/git.ts
  - plugins/scanners/csharp/src/adapter.ts
  - src/architecture-watch.ts
  - src/scanner.ts
  - src/viewers/web/server.ts
  - src/viewers/web/export.ts
  - test-bun/web-live.test.ts
  - test-bun/web-export.test.ts
  - test-bun/web-task-live.test.ts
  - src/cli.ts
  - src/view-host.ts
  - test-bun/okf-profile-view.test.ts
  - test/cli-scan.test.ts
  - src/world-layout.ts
  - test/edit.test.ts
  - test/relate.test.ts
  - groma/observed/systems/groma/containers/cli/components/commands.md
  - groma/observed/systems/groma/containers/cli/components/create.md
  - groma/observed/systems/groma/containers/cli/components/instructions.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/scanner-modules.md
  - >-
    groma/observed/systems/groma/containers/cli/components/cli-agent-instructions.md
  - groma/observed/systems/groma/containers/scanner/components/naming.md
  - plugins/work-sources/backlog/src/index.ts
  - test-bun/work.test.ts
  - src/welcome.ts
  - test-bun/welcome.test.ts
  - plugins/work-sources/backlog/package.json
  - bun.lock
  - >-
    groma/observed/systems/groma/containers/cli/components/architecture-comparison.md
  - groma/observed/systems/groma/containers/cli/components/edit.md
  - groma/observed/systems/groma/containers/cli/components/observed-curation.md
  - >-
    groma/observed/systems/groma/containers/cli/components/project-initialization.md
  - groma/observed/systems/groma/containers/core/components/accept.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-model.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-reader.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-writer.md
  - groma/observed/systems/groma/containers/core/components/groma-filesystem.md
  - groma/observed/systems/groma/containers/core/components/project-profile.md
  - groma/observed/systems/groma/containers/scanner/components/scan-lifecycle.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/architecture-watch.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/revision-history.md
priority: high
ordinal: 250000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer runs Groma from a normal Windows checkout, the launcher, terminal map, browser map, exports, historical revisions, scanners, and repository checks must work with Windows paths, CRLF checkouts, and executable rules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With core.autocrlf enabled, the bare launcher can enter both viewer actions without scan rejecting valid architecture Markdown.
- [x] #2 groma view renders the current repository architecture in a Windows terminal and directional input changes selection without a routing failure.
- [x] #3 groma web starts on Windows, serves the current map at localhost, and a primary visible control changes UI state without browser warnings or errors.
- [x] #4 Static export and historical revision loading work with Windows paths and line endings.
- [x] #5 The optional C# scanner adapter supports the executable host used by its Windows test while preserving normal dotnet execution.
- [x] #6 bun run check passes on Windows.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce Windows failures across the launcher, TUI, Web, export, history, scanners, and checks.
2. Normalize Windows paths and CRLF at the owning boundaries; make routing, layout, scanner hosting, and watcher shutdown deterministic.
3. Keep bare-launcher viewer transitions alive through OpenTUI teardown, using a fresh Bun child for the terminal renderer.
4. Read Backlog task Markdown directly for Web work data, then verify focused behavior, real Windows flows, browser interaction, history, export, and the full repository check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Windows corrections implemented:
- Markdown emit/update normalizes CRLF; Git history archives with core.autocrlf disabled; Web bundling converts file URLs correctly; scrollbar path checks normalize separators; C# script adapters use the Bun/Node host on Windows while dotnet stays unchanged.
- Sheet routing now assigns enough building ports for the current world, and world layout selects the runtime-safe ELK entry on Node versus Bun.
- Scanner, architecture watcher, terminal host, Web server, and static export shutdown now await owned work instead of racing Windows temp cleanup.
- Bare launcher teardown keeps the process alive until the chosen action owns a runtime handle. Web starts in the same process; TUI starts in a fresh Bun child so a second OpenTUI native renderer is never created in the launcher process.
- Web work data reads Backlog Markdown directly because released Backlog CLIs do not expose the assumed JSON flags. Summary reads parse each active task once; detail reads locate one task file. Authored and authorless comment blocks are both preserved.

Correction history:
- Real current-world TUI startup exposed an overloaded building-port routing failure; added the focused busy-building regression and degree-aware capacity.
- Windows tests exposed watcher callbacks still owning temp files after close; shutdown now awaits active scans/publishes.
- Real static export exposed unsupported Backlog --json flags; replaced the CLI JSON dependency with the current Markdown contract and corrected selected-detail lookup from all-task parsing to one file.
- Real bare launcher testing exposed process exit during OpenTUI teardown; added a lifecycle hold and a clean child-process handoff for the terminal viewer.
- Quality review found valid authorless Backlog comments were omitted; parser and regression now cover both formats, and real TASK-165 returns all 43 comments.

Verification evidence:
- Bare launcher on Windows: Enter started `groma web at http://localhost:4747`; Down+Enter launched the current 74-element terminal map. Right Arrow changed selection/details from Groma to Git without routing failure.
- Live Web at localhost: current 74-element map rendered; theme control changed `data-theme` and URL to dark; browser warnings/errors were empty. Historical commit b2cd9b6 loaded as a 72-element map and updated the revision URL with no warnings/errors.
- Real static export completed and produced index.html, render.js, snapshot.js, and version.js.
- Focused Work/export tests pass; real TASK-165 parses 43 comments.
- `bun run check` passes on Windows: Biome error gate and SVG guard, TypeScript, 94 Node tests, and 221 Bun tests. Existing Biome complexity diagnostics remain warning-only and predate this task.
- Cold simplicity review passed after reducing test-bun/web-live.test.ts to exactly 500 lines. Quality review's single comment-parser blocker was fixed and its targeted re-review passed.

Specification review reproduced the launcher transition as intermittent. Final correction suspends the welcome renderer on selection, starts and owns the selected Web/TUI action, then destroys the already-suspended renderer; this removes native teardown from the key/render cycle. Added a focused suspend-handoff regression. Fresh PTY verification passed Web twice consecutively and TUI once after the correction.

Final targeted specification re-review passed AC #1 after two consecutive bare Web PTY launches and one bare TUI launch. Final bun run check passes 94 Node and 222 Bun tests.

Post-pull integration on Windows: fast-forwarded main by 8 commits and resolved four stash-apply conflicts in the moved Backlog work-source, architecture watcher, CLI launcher, and Work tests. Kept upstream project initialization and plugin boundaries while preserving direct Backlog Markdown reads, awaited watcher shutdown, and the suspended splash handoff. Added Windows discovery for backlog.exe/backlog.cmd and updated the welcome fixture for initialized Groma storage. bun run check passes after integration with 104 Node and 227 Bun tests. Real PTY verification passed splash to Web, splash to TUI, and directional TUI selection; browser QA rendered 77 elements, changed the theme URL/state to dark, and reported no warning/error logs. Real static export produced index.html, render.js, snapshot.js, and version.js.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the Windows compatibility pass for the Groma splash launcher, terminal viewer, live Web viewer, static export, Git revision loading, scanner host, routing, layout, and watcher lifecycle. The bare launcher now hands off deterministically by suspending OpenTUI before starting Web or a fresh TUI child; CRLF and Windows paths are normalized at their owning boundaries; current-world routing no longer exhausts building ports; Backlog work reads the repository's real task Markdown without unsupported CLI JSON flags; and shutdown awaits owned work.

Verified on Windows with repeated real PTY launcher transitions, directional TUI navigation, live browser theme and historical-revision interaction with no console warnings/errors, a complete four-file static export, focused regressions including C# host selection, 43/43 real TASK-165 comments, clean diff checks, cold simplicity review, resolved specification and quality reviews, and `bun run check` passing 94 Node plus 222 Bun tests.

Integrated TASK-232 cleanly over the latest main: no unmerged paths or conflict markers remain, main matches origin/main, the complete check passes, and real Windows splash, TUI, Web, browser interaction, and static export paths succeed.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
