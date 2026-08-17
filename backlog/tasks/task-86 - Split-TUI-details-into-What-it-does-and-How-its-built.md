---
id: TASK-86
title: Split TUI details into What it does and How it's built
status: Done
assignee:
  - '@claude'
created_date: '2026-08-17 21:38'
updated_date: '2026-08-17 22:01'
labels: []
dependencies: []
priority: high
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI details pane shows one flat column. Split it like the web viewer: What it does keeps the meaning (description, relationships, children); How it's built shows the evidence: declared technology, the code files with a files-and-lines weight line, and the person commands whose walk touches the selection, each pickable. t toggles the tabs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The details pane offers What it does and How it's built, toggled with t; the choice persists across selections
- [x] #2 What it does keeps today's description, relationships, and children; How it's built shows the code references with a files-and-lines line when code is observed
- [x] #3 A technology declared in the element's Markdown renders under How it's built
- [x] #4 How it's built lists the person commands whose walk touches the selection; choosing one with the details cursor lights that walk
- [x] #5 Tab state and the pickable-rows derivation are covered by fixture tests and bun test passes
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
1. navigation.ts: DetailsTab ('what' | 'how') on ViewerState (initial 'what'); 'toggle-details-tab' action (key t) flips it and resets the details scroll; a shared detailsCommands(world, state) returns the pane's pickable rows: person commands on What, travelledBy on How; the details focus branch uses it for cursor and Enter.
2. organisms/details.ts: a tabs row under the kind line, active tab accent bold; What keeps description/relationships/children; How shows Technology (comma-split), Code prefixed with 'N files · ~M lines' from codeLines, and pickable Travelled by rows sharing the cursor/active styling.
3. paint.ts and terminal-viewer.ts pass detailsTab through; the picking footer flag uses detailsCommands; details hints gain 't tab'.
4. Tests: initialState gains detailsTab; toggle flips and persists across selection and resets scroll; on How the cursor walks travelledBy rows and Enter picks; What keeps scrolling for non-persons.
5. bunx tsc, bun test, agent-tty check of both tabs, the weight line, technology, and a travelled-by pick.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
detailsTab ('what' | 'how') on ViewerState, toggled by t via 'toggle-details-tab' (resets details scroll, persists across selection). Shared detailsCommands(world, state) supplies the pane's pickable rows: person commands on What, travelledBy on How; both the reducer's cursor/Enter and the footer picking flag use it. detailsRows renders the tabs row and branches: What keeps description/relationships/children, How shows Technology (comma-split), Code with 'N file(s) · ~M lines' from codeLines, and pickable Travelled by rows. agent-tty evidence at 120x36: Web viewer's How tab showed 'Technology / Three.js · Bun serve', 'Code / 1 file · ~116 lines / src/viewers/web/server.ts', 'Travelled by / → Starts the browser map'; Coding agent's How tab listed four walks, Down+Enter picked 'Accepts a matched ghost' and it stayed lit after Esc. Fixture tests: toggle flips and resets scroll, tab persists across moves, How cursor walks travelledBy and Enter picks, What scrolls for non-persons; chrome test updated to find code on the How tab. bunx tsc clean, bun test 155 pass.

Cold simplicity review: applied the accept-worthy byId hoist reversal (the map now lives only in the What branch that uses it) and the WorldRelationship[] return-type nit; the footer hint trims were confirmed intentional width-budget choices. Also stabilized the pre-existing suite flake (viewer-lifecycle headless-keys test now carries a 20s timeout; it was hitting bun's 5s default under parallel load), committed separately. Post-review: bunx tsc clean, bun test 155 pass three times in a row.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI details pane now splits into What it does (description, relationships, children) and How it's built (technology from Markdown, code references under a files-and-lines weight line from codeLines, and pickable Travelled by walks), toggled with t and persistent across selections; the details cursor and Enter follow the visible tab through the shared detailsCommands derivation. Verified with navigation fixture tests (toggle, persistence, How-tab cursor walk and pick, What-tab scrolling), an updated chrome test finding code on the How tab, and agent-tty at 120x36 (Web viewer chips and weight line, Coding agent travelled-by pick staying lit). bunx tsc clean, bun test 155 pass.
<!-- SECTION:FINAL_SUMMARY:END -->
