---
id: TASK-229
title: Turn Groma instructions into a second welcome view
status: Done
assignee:
  - '@codex'
created_date: '2026-08-31 18:35'
updated_date: '2026-08-31 19:04'
labels: []
dependencies: []
references:
  - welcome
  - instructions
  - commands
modified_files:
  - src/instructions.ts
  - src/welcome/model.ts
  - src/welcome/view.ts
  - src/welcome.ts
  - src/cli.ts
  - test-bun/welcome.test.ts
  - README.md
  - docs/product-model.md
  - docs/index.md
  - groma/observed/systems/groma/containers/cli/components/welcome.md
  - groma/observed/systems/groma/containers/cli/components/instructions.md
ordinal: 248000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer can enter an Instructions screen from the bare Groma launcher or by running groma instructions on a TTY. The screen keeps the launcher brand and repository context, defaults to Overview, lists the shipped guides, renders the selected Markdown and ASCII content below, and returns to the main launcher through Backspace or a visible Back row. Named guides and non-interactive use remain plain text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The main Groma launcher removes the groma --help action and replaces it with an executable groma instructions action; Advanced commands remains a read-only reference section.
- [x] #2 Bare groma instructions on a TTY opens an Instructions screen that preserves the launcher logo, version, documentation link, project, folder, status, and terminal theme.
- [x] #3 The Instructions screen selects Overview by default, lists every shipped guide in the established table style, and renders the selected guide below with readable Markdown structure and preserved ASCII diagrams or code blocks.
- [x] #4 Up and Down change the selected guide and reset its content position; Page Up and Page Down scroll long guide content.
- [x] #5 Backspace and an Enter-activated Back row return to the main launcher without dispatching a command.
- [x] #6 groma instructions <guide>, non-interactive groma instructions, and groma --plain keep stable plain-text behavior.
- [x] #7 Product documentation and observed architecture describe the shared Welcome shell and its Launcher and Instructions screens.
- [x] #8 In Instructions, J and K scroll content one line down and up while Page Down and Page Up still move one page.
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
1. Split the near-limit Welcome module into a domain folder: shared content and table models, shared shell and screen painting, and the public controller entry point.
2. Replace the Help launcher action with internal navigation to an Instructions state; keep executable action IDs limited to Web, View, and Scan.
3. Define one shipped-guide catalog, render Overview by default with Markdown structure and preserved code or ASCII lines, switch guides with Up and Down, and return through Backspace or the Back row.
4. Scroll instruction content one line with J and K and one page with Page Up and Page Down.
5. Make bare interactive groma instructions start on that state while named guides, non-interactive use, and plain output continue through the same guide catalog.
6. Add focused lifecycle, navigation, rendering, plain-output, and CLI tests; update product documentation and observed architecture through Groma.
7. Run focused checks, 80-column terminal verification, the repository check, cold simplicity review, specification and quality reviews, and the required full-context complexity review before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one Welcome domain with a shared shell, Launcher and Instructions states, one shipped-guide catalog, and executable action IDs limited to Web, View, and Scan. Bare interactive instructions starts the Instructions state; named, plain, and non-TTY forms use the same catalog as text.

Cold simplicity review passed. Applied its scoped reductions: renamed the shared controller entry points, removed unused catalog fields, and shortened the Advanced reference test.

Quality review found that the generic project Markdown parser treated command placeholders such as <name> as HTML and flattened nested bullets. Replaced it with an Instructions-owned line renderer for headings, blank lines, ordered and nested unordered lists, fenced ASCII/code, and literal command syntax. Added a command-placeholder regression assertion and launcher-to-Instructions coverage.

Verification: focused Biome lint and TypeScript pass; 8/8 Welcome tests and 6/6 instruction CLI tests pass. Scripted 80-column frames verify the shared shell, Overview ASCII pipeline, nested workflow, literal Authoring parameters, selection, paging, and return. Full bun run check reaches 89/91 Node tests; only the known shared watcher failures remain (EMFILE and its dependent empty scan-watch output).

Added the requested J/K aliases through one shared vertical-direction helper. Updated both screen hints and product docs; focused tests exercise J/K in the Launcher, guide selection, and Back-row navigation. The post-change full check again reached 89/91 Node tests with only the same unrelated watcher failures.

Corrected the first J/K interpretation after clarification: J/K now scroll only Instructions content by one line; arrows keep guide and launcher selection, and Page Up/Page Down keep full-page movement. The 80-column footer exposes all three controls, and focused tests verify J/K and page-key round trips.

Applied the full-context reviewer’s remaining simplification: Instructions now derives the selected guide from its selected row instead of storing a second guideIndex, removing an invalid state. Final focused lint, typecheck, 8 Welcome tests, 6 CLI guide tests, diff check, and 80-column hint verification pass. The final full check remains 89/91 only because of the same shared watcher failures.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the splash Help action with a shared Instructions screen that keeps the Welcome shell, renders the shipped Overview and Authoring guides with preserved Markdown structure, ASCII, nesting, and literal command parameters, and returns without dispatch. Arrows select guides, J/K scroll one line, and Page Up/Page Down move one page. Named and non-interactive guide output remains plain. Verified with 8 Welcome tests, 6 CLI guide tests, focused lint, TypeScript, diff checks, 80-column renderer frames, simplicity/specification/quality reviews, and the required full-context architecture review; the full repository check remains 89/91 only because of the existing shared watcher EMFILE failures.
<!-- SECTION:FINAL_SUMMARY:END -->
