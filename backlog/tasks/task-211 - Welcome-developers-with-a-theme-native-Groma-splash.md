---
id: TASK-211
title: Welcome developers with a theme-native Groma splash
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-30 12:10'
updated_date: '2026-08-30 18:41'
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
When a developer runs bare groma in an interactive terminal from a repository folder, Groma opens the approved compact technical-sheet launcher and waits for keyboard input. It identifies the installed Groma version, documentation address, current project and folder, architecture readiness, and the next CLI actions. Up and Down select an action, the selected right arrow blinks, and Enter runs that action. Escape or q exits without running an action, and a footer shows the available controls. Non-interactive output remains stable plain text for scripts. The visible actions describe real behavior: groma web and groma view scan before opening their maps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bare `groma` on a TTY opens the approved technical-sheet launcher and stays active, showing a faithful connected-line Groma mark, `groma.md`, installed version, `https://groma.md`, current project, current folder, architecture readiness, and command rows.
- [x] #2 The first action is selected initially, its right arrow blinks, Up and Down move the selection through the actions, and Enter closes the launcher before running the selected command through the same operation as the named CLI command.
- [x] #3 `groma web` appears above `groma view`; their descriptions say they run the scan and open the map in the browser or terminal respectively.
- [x] #4 `groma web` and map-opening `groma view` flows scan the current repository before opening the requested map.
- [x] #5 Piped bare `groma` and `groma --plain` print stable plain text without ANSI escape sequences or waiting for input.
- [x] #6 The displayed version comes from the package version, whose approved initial value is `0.1.0`.
- [x] #7 Escape and q close the interactive launcher without running an action, and a dim footer beneath the command table lists Up/Down navigation, Enter run, and Esc/Q quit.
- [x] #8 When a developer opens the launcher in a light or dark terminal, or switches that terminal theme while the launcher remains open, its neutral foreground and background follow the terminal defaults immediately while every green accent remains exactly #1D9E75.
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

5. Replace whole-screen centering with a fixed two-row, two-column launcher inset while preserving the existing sheet, palette, actions, and keyboard behavior; run focused launcher checks and inspect a real TTY.

6. Route Escape and q through the existing launcher close path, add one dim controls footer beneath the command table, and verify both exit keys plus the rendered frame without testing decorative copy.

7. Replace Welcome startup palette querying with OpenTUI theme-mode detection, select one explicit dark or light neutral palette before mount, preserve the exact brand green, and verify both rendered modes.

8. Keep the detected theme mode as Welcome state, subscribe once to OpenTUI theme_mode changes, repaint immediately, and remove the listener through the existing close path; verify live color changes and listener cleanup.

9. Replace explicit theme detection and repainting with OpenTUI terminal-default foreground and background color intents, letting the terminal own startup and live theme changes; remove the synthetic event test and verify the default color intents plus the exact brand green.
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

Alex approved an upper-left terminal layout after reviewing the centered launcher: keep the logo aligned within the sheet, but anchor the complete launcher near the prompt instead of centering it in the terminal.

Changed src/welcome.ts only: paintWelcome now uses the approved two-row, two-column inset, reduced only when the terminal has less spare space. The sheet content, internal alignment, palette, actions, blink, navigation, and dispatch remain unchanged. src/welcome.ts was already present in TASK-211's modified-file list and welcome remains its architecture reference.

Upper-left revision focused verification passes: 3/3 welcome lifecycle/navigation tests, focused Biome, TypeScript, and git diff --check. tui-test still cannot start its daemon on the shared host, so the same OpenTUI test renderer captured a 100x30 frame: two blank rows precede the mark, the context and command tables start at column 3, and the remaining terminal stays empty. No content or interaction changed.

Cold simplicity review found the first inset expressions added unapproved viewport-dependent reduction. Accepted the finding and simplified paintWelcome to the exact approved fixed coordinates x = 2 and y = 2. This supersedes the earlier note about reducing the inset in smaller terminals; no adaptive layout behavior is part of this revision.

Upper-left cold simplicity gate passed after the fixed-coordinate correction. The targeted re-review confirmed the current diff only replaces centered coordinates with x = 2 and y = 2, with no adaptive behavior or regression. A full bun run check again passed lint and TypeScript but stopped in the same unrelated shared-host failures: watchScan received EMFILE and the CLI scan-watch test timed out with no output.

The full-context specification, quality, complexity, domain-grouping, and junior-safety review passed the fixed upper-left architecture. Accepted its only in-scope cleanup: removed the now-unused WelcomeSheet.height field and calculation because centering was their sole consumer. Welcome remains one domain module and Commands retains exhaustive action execution.

Alex requested two explicit quit keys and visible guidance at the bottom of the upper-left launcher. This extends only Welcome input and paint behavior; quitting must resolve without an action so Commands performs no dispatch.

Changed src/welcome.ts: Escape and q now enter the same close(undefined) path as Ctrl-C, so cleanup completes and no Welcome action reaches Commands. Added one dim controls line beneath the command table. src/welcome.ts and the welcome architecture reference were already recorded for TASK-211.

Changed test-bun/welcome.test.ts with one parallel-safe behavior test covering both Escape and q. Each key mounts its own renderer and proves quitting resolves without an action and destroys the renderer. The test intentionally does not assert decorative footer wording.

Quit/footer focused verification passes: 4/4 Welcome tests, focused Biome, TypeScript, and git diff --check. A 100x30 OpenTUI frame keeps the fixed upper-left sheet and shows the dim controls footer on the first row beneath its blank separator: Up/Down navigate, Enter run, Esc/Q quit. The frame probe exited through Escape without dispatch.

Quit/footer cold simplicity review passed with no findings. The reviewer confirmed one key condition, the existing close(undefined) cleanup path, one footer paint call, and one loop-based behavior test are already minimal. Full bun run check again stopped only in the same unrelated shared-host watcher failures: 88/90 Node tests passed; watchScan received EMFILE and the CLI scan-watch test timed out.

Alex reproduced the launcher opening white-on-black in a white terminal. This invalidates the previous AC #2 evidence. Local OpenTUI 0.5.1 and its official renderer guidance identify waitForThemeMode as the startup API for choosing a light/dark palette; normalizeTerminalPalette falls back to white-on-black when palette colors are missing. The final quit/footer review was paused until this supported-flow defect is corrected.

Changed src/welcome.ts: Welcome no longer queries and normalizes the full terminal palette. Startup waits for OpenTUI theme mode before mount, keeps the existing dark white-on-black palette when mode is dark or unavailable, and uses black-on-white when mode is light. All accents still share the single #1D9E75 brandGreen. This remains owned by the Welcome domain; the terminal map palette path is unchanged.

Changed test-bun/welcome.test.ts: existing launcher tests now mount the dark mode explicitly, and one behavior test paints both modes to prove dark is white-on-black, light is black-on-white, and .md remains #1D9E75 on both backgrounds. The test uses one minimal title span as its palette observation anchor.

Theme-mode focused verification passes: 5/5 Welcome tests, focused Biome, TypeScript, and git diff --check. The color test inspects actual OpenTUI spans for both modes and proves neutral inversion plus invariant #1D9E75. Startup now follows OpenTUI's documented waitForThemeMode-before-first-paint path; Alex's real white-terminal verification remains the final visual evidence.

Theme correction cold simplicity review passed with no findings. It confirmed the direct ownership path: CLI mode choice, OpenTUI theme wait, one typed Welcome theme map, paint/input/cleanup, then optional exhaustive Commands dispatch. Full bun run check again stopped only at the same shared-host EMFILE watcher failures after lint and TypeScript passed and 88/90 Node tests passed.

Final full-context specification, quality, complexity, domain-grouping, and junior-safety review found no TASK-211 implementation defect or remaining simplification. It confirmed Welcome owns theme/presentation/input/cleanup, Commands owns exhaustive execution, and one close path keeps quit distinct from actions. AC #7 is proven by the 5/5 focused tests and rendered footer frame. AC #8 remains open only for Alex to confirm OpenTUI reports the real white terminal as light; automated spans already prove correct painting after either detected mode.

Alex approved live theme switching while the launcher remains open. The supported design is one Welcome-owned OpenTUI theme_mode listener that updates the existing mode and repaints; it uses the existing close path for cleanup, with no polling, global theme service, or palette-query fallback.

Changed src/welcome.ts: the mounted launcher now keeps mutable theme-mode state, reads the renderer current mode when available, subscribes once to theme_mode changes, repaints through the existing function, and removes that listener in the shared close path.

Changed test-bun/welcome.test.ts: the existing palette behavior test now starts in light mode, emits a live dark-mode event, and proves both repaints retain #1D9E75; the cleanup test also proves the theme listener is released with the existing input handler.

Live-theme focused verification passes: 5/5 Welcome tests, focused Biome, TypeScript, and git diff --check. One mounted launcher starts light, receives theme_mode dark, repaints its neutral colors immediately, preserves #1D9E75 in both frames, and returns its theme listener count to baseline on close.

Full bun run check after live-theme support: focused lint and TypeScript still pass, and 88/90 Node tests pass. The run exits 1 only in the same shared-host watcher failures: watchScan receives EMFILE and the CLI watch test times out with empty output. The Welcome tests pass and no TASK-211 path appears in either failure.

Live-theme cold simplicity review passed with no findings. It traced waitForThemeMode to one mutable Welcome mode, one theme_mode listener, the existing repaint path, and cleanup through the shared close function. It found nothing to delete or collapse and judged the adjacent domain-owned flow easy for an unfamiliar developer to follow.

Final full-context review passed with no blocking TASK-211 defect or useful in-scope simplification. It judged the single Welcome-owned mode, typed two-mode palette, one theme event handler, one repaint path, and one cleanup path the simplest and safest design for junior developers. AC #9 is proven by the live repaint and listener-cleanup tests. AC #8 still needs Alex to confirm the real white terminal is detected as light; DoD #2 remains blocked by the unrelated shared-host EMFILE watcher failures.

Alex tested the supported real-terminal flow and live theme switching did not work. This invalidates AC #9 despite the synthetic renderer event test. Investigation must determine what signal the actual terminal/OpenTUI path exposes before choosing a replacement; do not treat a manually emitted theme_mode event as end-to-end evidence.

Investigation found the failed assumption: OpenTUI live theme_mode events depend on DEC mode 2031, which unsupported terminals do not send; OSC 10/11 is only a startup fallback. OpenTUI defaultForeground/defaultBackground carry terminal-default color intent and the native renderer emits SGR 39/49, so the terminal itself can update existing neutral cells on any theme switch. This removes detection, event state, listener cleanup, and polling.

Changed src/welcome.ts: removed waitForThemeMode, the explicit light/dark palette map, mutable theme state, and the theme listener. Welcome neutral cells now use RGBA.defaultForeground/defaultBackground so OpenTUI emits terminal-default SGR 39/49; #1D9E75 remains the only explicit accent color.

Changed test-bun/welcome.test.ts: removed synthetic theme_mode emission and theme-listener assertions. The palette behavior test now proves neutral title cells carry OpenTUI default color intent while the .md accent remains RGB #1D9E75 on a default background.

Terminal-default focused verification now passes: 5/5 Welcome tests, focused Biome, TypeScript, and diff checks. A real PTY capture of bun src/cli.ts shows neutral Welcome text emitted with SGR 39/49 and accents with 38;2;29;158;117 plus SGR 49, proving the compiled OpenTUI path preserves terminal-default foreground/background rather than baking in black or white.

Full bun run check after the terminal-default correction again passes lint and TypeScript and 88/90 Node tests. It exits 1 only in the same shared-host watcher failures: watchScan receives EMFILE and the CLI watcher test times out with empty output; TASK-211 tests pass.

Accepted the cold simplicity finding in src/welcome.ts: drawParts, drawContext, and drawCommands no longer accept palette parameters. They use the module terminal-default pair directly, deleting false Welcome palette configurability and making the neutral-color invariant harder to bypass.

Focused checks after the accepted simplification pass: 5/5 Welcome tests, focused Biome, TypeScript, and diff checks. The helpers now expose no alternate neutral palette path.

The permitted targeted simplicity re-review passed. It confirmed all Welcome-only helpers now use the terminal-default invariant directly, the focused default-intent/brand-green evidence remains intact, and the simplification introduced no regression.

Final full-context review passed the corrected architecture with no implementation finding. It confirmed the test now validates the real terminal-default color contract rather than a synthetic event; the domain-local constants and parameter-free helpers are simpler, easier to find, and safer for junior developers. AC #8 remains open only for Alex to confirm the corrected build in his terminal.

Alex confirmed the corrected global groma launcher follows a real terminal theme switch while it remains open. This supplies the required supported-flow evidence for AC #8. The final full check still exits only on the unrelated host watcher exhaustion (EMFILE plus its CLI timeout), including when those two tests run alone; all TASK-211 focused checks pass. Commit and push approved by Alex.
<!-- SECTION:NOTES:END -->
