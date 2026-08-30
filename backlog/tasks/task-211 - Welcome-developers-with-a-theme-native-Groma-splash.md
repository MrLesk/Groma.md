---
id: TASK-211
title: Welcome developers with a theme-native Groma splash
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-30 12:10'
updated_date: '2026-08-30 14:02'
labels: []
dependencies: []
references:
  - instructions
  - commands
  - welcome
modified_files:
  - package.json
  - src/instructions.ts
  - src/cli.ts
  - test/instructions.test.ts
  - README.md
  - docs/product-model.md
  - docs/scanners/index.md
  - docs/viewers/tui/index.md
  - groma/observed/systems/groma/containers/cli/components/instructions.md
  - groma/observed/systems/groma/containers/cli/components/commands.md
  - src/welcome.ts
  - test-bun/welcome.test.ts
  - groma/observed/systems/groma/containers/cli/components/welcome.md
priority: high
type: feature
ordinal: 224000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer runs bare `groma` in an interactive terminal from a repository folder, Groma opens the approved compact technical-sheet launcher and waits for keyboard input. It identifies the installed Groma version, documentation address, current project and folder, architecture readiness, and the next CLI actions. Up and Down select an action, the selected right arrow blinks, and Enter runs that action. Non-interactive output remains stable plain text for scripts. The visible actions describe real behavior: `groma web` and `groma view` scan before opening their maps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bare `groma` on a TTY opens the approved technical-sheet launcher and stays active, showing a faithful connected-line Groma mark, `groma.md`, installed version, `https://groma.md`, current project, current folder, architecture readiness, and command rows.
- [x] #2 The launcher uses the logo green `#1D9E75` for every green accent and uses the terminal palette for foreground and background so it works in light and dark themes.
- [x] #3 The first action is selected initially, its right arrow blinks, Up and Down move the selection through the actions, and Enter closes the launcher before running the selected command through the same operation as the named CLI command.
- [x] #4 `groma web` appears above `groma view`; their descriptions say they run the scan and open the map in the browser or terminal respectively.
- [x] #5 `groma web` and map-opening `groma view` flows scan the current repository before opening the requested map.
- [x] #6 Piped bare `groma` and `groma --plain` print stable plain text without ANSI escape sequences or waiting for input.
- [x] #7 The displayed version comes from the package version, whose approved initial value is `0.1.0`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Separate the welcome domain from shipped agent instructions: keep one welcome model and ordered action list, render stable plain output for scripts, and mount an OpenTUI launcher for a TTY with the connected text mark and exact `#1D9E75` accent. 2. Return the selected action to the CLI, close the launcher cleanly, and route it through the same web, terminal-view, one-shot scan, or help operation used by named commands. 3. Update the public and authored CLI meaning from a printed splash to a keyboard-driven launcher. 4. Verify navigation and action dispatch with focused behavior tests, inspect the real TTY launcher and blink, run `bun run check`, then repeat the required simplicity, specification, quality, and full-context architecture reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the shared welcome model, ANSI and plain renderers, package-backed 0.1.0 version, web-first guidance, and CLI-level initial scans before interactive view and web startup. Updated the authored CLI meaning and public scan/view contract. Focused welcome and plain-view tests pass 12/12; focused Biome lint and typecheck pass. A combined focused run also hit the existing scan-watch timing assertion once; the changed code does not enter that watcher path, so the full repository check will determine whether it reproduces.

Repository check attempted twice. Lint (with existing complexity warnings) and typecheck pass, and all TASK-211 tests pass inside the suite. The same two pre-existing watcher tests fail because the shared host is exhausted by concurrent long-running viewer processes: watchScan reports EMFILE and the CLI watch test then times out with no output. I did not stop those processes because they belong to other work.

Cold simplicity review passed with no findings. The reviewer traced bare groma to one shared renderer, web and interactive view to explicit scan-then-open actions, and plain or targeted view to existing-world reads. It found no code, concept, documentation, or test that could be deleted or collapsed without duplication or a less obvious flow.

Specification and quality review passed all six acceptance criteria. Real PTY output verified the complete terminal sheet and theme-native ANSI use; temporary repository probes verified scan-before-open for web and interactive view and confirmed plain or targeted view remains read-only. One finalization blocker remains: bun run check exits 1 because concurrent long-running viewers exhaust host filesystem watchers, causing the existing scan-watch tests to fail. Non-blocking observations: command-level TTY/scan ordering is proved by probes rather than automated tests; host-test names still use the old public phrasing; the authored Commands-to-Scan relationship row still names only explicit groma scan.

Full-context architecture review: keep the implementation approach. The reviewer found clear ownership, a short user-action-to-result path, no worthwhile production-code collapse, and no architecture or complexity blocker. The explicit scan-before-host calls are safer and clearer than a new abstraction. Non-blocking choices for Alex: (1) rename two existing host-level tests whose names still imply public groma view/web commands do not scan; (2) clarify the web viewer documentation after coordinating because that file contains unrelated shared work; (3) make splash tests derive the project basename instead of hardcoding groma3. The known external bun run check blocker remains host watcher resource exhaustion; do not stop other work.

Alex corrected the first implementation: interactive means a persistent keyboard launcher, not TTY-styled output that exits. The logo must use a faithful connected-line terminal mark, and every green accent must use the real logo green #1D9E75. TASK-211 acceptance and plan were replaced before the correction was implemented.

Implemented the corrected welcome flow. The static agent guides remain in src/instructions.ts; src/welcome.ts now owns one ordered action list, plain rendering, the faithful connected-line mark, exact #1D9E75 accent, OpenTUI paint/input/blink state, and cleanup. Bare TTY groma waits for a selected action; CLI helpers own web, terminal-view, one-shot scan, and help so menu Enter and named commands share the same operations. Focused evidence: Biome passes, typecheck passes, 3/3 welcome lifecycle/navigation tests pass, and 11/11 CLI/plain-view tests pass. A direct real PTY showed the arrow alternating visible/hidden, Down moving selection, exact 38;2;29;158;117 output, and Enter on Help restoring the terminal before printing help. tui-test itself remains unable to start its daemon because of the shared host resource exhaustion.

Corrected cold simplicity review passed with no blocker. It confirmed one action list, one plain renderer, one OpenTUI frame, and shared CLI operations as the simplest suitable architecture. Accepted its in-scope subtraction: removed unused injectable start options and launcher controller, made mount return the selection promise directly, computed sheet geometry once, removed redundant width/title calculations, and collapsed cleanup into one close path that destroys the renderer before resolving. src/welcome.ts fell from 426 to 401 lines. Focused lint, typecheck, 3/3 launcher tests, and git diff --check pass after the simplification. The live scanner generated the Welcome architecture component from src/welcome.ts; TASK-211 adopted the file and exact welcome reference, then authored its meaning and narrowed Instructions back to the shipped guides.

Corrected specification and quality review passed all seven acceptance criteria with no task defect. Independent evidence: real PTY remained active, rendered the connected mark, blinked and moved selection, restored the terminal before Help, and dispatched Enter; light/dark palette probes used only supplied foreground/background plus #1D9E75; dispatch probes showed named Web scan→web, named View scan→view, and launcher Web launcher→scan→web; piped and TTY --plain exited without ANSI or waiting; version remained package-backed 0.1.0. Focused Biome, typecheck, 3/3 launcher tests, 11/11 CLI/plain-view tests, and task diff checks pass. The corrected full bun run check again exits 1 only in host-resource-dependent tests: watchScan receives EMFILE, CLI watch times out, and separate probes show ephemeral port binding also failing on the host. TASK-211 package scope remains only the version line; the TypeScript pin and bun.lock belong to TASK-213. Non-blocking observations remain the old host-test names and the Commands-to-Scan relationship label.

Final full-context architecture review found no architecture or complexity blocker and recommends keeping the overall approach. Welcome cleanly owns repository context, action order, presentation, input/blink/cleanup; Commands owns execution; package metadata owns version; the terminal palette owns foreground/background; one #1D9E75 constant owns Welcome accents. One non-blocking junior-safety improvement is proposed for Alex to decide: make runWelcomeAction exhaustive, because its current final Help branch would silently route a future unhandled action to Help. The reviewer recommends an exhaustive switch with a never check or a Record mapping. A second non-blocking authored-architecture cleanup remains: the Commands-to-Scan relationship row labels only groma scan although Web and interactive View also scan. No shared brand-token module or welcome file split is recommended.

Alex approved the final architecture recommendation. runWelcomeAction now uses an explicit exhaustive switch and a never-typed unhandled branch, so adding a welcome action without an owning CLI operation fails typecheck instead of silently opening Help. Focused Biome, typecheck, 3/3 launcher tests, 11/11 CLI/plain-view tests, and git diff --check pass. The same full-context reviewer performed the permitted targeted re-review and confirmed the junior-safety finding is resolved with no task-scoped regression.

Final repository check was attempted again after Alex approved commit and push. All TASK-211 tests, focused lint, and typecheck pass; the repository run still fails only because the shared host returns EMFILE for filesystem watchers, followed by the known CLI watch timeout. The task remains In Progress with Definition of Done #2 open, while the verified task-scoped patch is committed at Alex request.
<!-- SECTION:NOTES:END -->
