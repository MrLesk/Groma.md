---
id: TASK-244
title: Restore the approved Terminal Facelift view
status: Done
assignee:
  - '@codex'
created_date: '2026-09-04 06:25'
updated_date: '2026-09-05 15:16'
labels:
  - tui
  - render
dependencies: []
references:
  - /Users/alex/Downloads/Terminal Facelift.pdf
  - projection
  - navigation
  - terminal-painting
  - hierarchy
  - navigation-spatial
  - work-focus
  - navigation-details
  - chrome
  - screen
  - surface
  - keys
  - details
  - flow
  - welcome
  - read-read
  - source-viewer
  - terminal-host
documentation:
  - docs/viewers/tui/interaction-spec.md
  - 'https://rataflow.furkankly.dev'
modified_files:
  - src/viewers/tui/projection-root.ts
  - src/viewers/tui/projection-container.ts
  - src/viewers/tui/projection.ts
  - src/viewers/tui/projection-routes.ts
  - src/viewers/tui/molecules/row.ts
  - src/viewers/tui/organisms/world.ts
  - src/viewers/tui/molecules/work-marker.ts
  - src/viewers/tui/navigation-spatial.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/terminal-viewer.ts
  - test-bun/root-layout.test.ts
  - test-bun/container-layout.test.ts
  - test-bun/projection.test.ts
  - test-bun/navigation.test.ts
  - test-bun/large-world.test.ts
  - test-bun/projection-routes.test.ts
  - src/viewers/tui/projection-sheet.ts
  - src/viewers/tui/model.ts
  - docs/viewers/tui/index.md
  - test-bun/chrome.test.ts
  - test-bun/tree.test.ts
  - src/viewers/tui/panes/hierarchy.ts
  - src/viewers/tui/work/navigation.ts
  - src/viewers/tui/navigation-details.ts
  - src/viewers/tui/panes/details.ts
  - src/viewers/tui/panes/chrome.ts
  - src/viewers/tui/panes/view.ts
  - src/viewers/tui/panes/screen.ts
  - src/viewers/tui/layout.ts
  - src/viewers/tui/molecules/surface.ts
  - src/viewers/tui/molecules/route.ts
  - src/viewers/tui/navigation-tree.ts
  - src/viewers/tui/work/rows.ts
  - src/viewers/tui/atoms/border.ts
  - test-bun/tui-source.test.ts
  - AGENTS.md
  - docs/viewers/index.md
  - docs/viewers/tui/interaction-spec.md
  - test-bun/work.test.ts
  - src/viewers/tui/keys.ts
  - src/viewers/tui/work/model.ts
  - src/viewers/tui/flow.ts
  - src/viewers/tui/paint.ts
  - src/welcome.ts
  - src/welcome/view.ts
  - test-bun/welcome.test.ts
  - test-bun/work-folding.test.ts
  - docs/product-model.md
  - test-bun/surface.test.ts
  - test-bun/routes.test.ts
  - src/viewers/source/highlight.ts
  - src/viewers/web/source/highlight.ts
  - src/viewers/tui/atoms/theme.ts
  - src/viewers/tui/panes/code.ts
  - src/view-host.ts
  - test-bun/tui-theme.test.ts
priority: high
type: bug
ordinal: 283000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect uses groma view and its related terminal reading views, Groma makes map flows, task intent and execution, and navigation understandable through the approved Terminal Facelift structure and current human QA refinements. Keep fitted geometry, bounded camera and shared task opening; use explicit single-flow checkboxes, plain surfaces, definition-first records, collapsible task status groups and arrow reading focus in advanced commands/instructions alongside j/k.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Root and container maps keep fixed readable scale, stable geometry and bounded navigation. Neighbouring containers occupy only narrow named edge strips; side names read vertically and top/bottom names horizontally.
- [x] #2 Actor details and hierarchy use Flows and the same single-flow checkbox behavior: browsing does not activate; Space/Enter toggles and clear restores the prior map view. Genuine software connections remain Relationships.
- [x] #3 Architecture surfaces remain plain and kind, origin, selection and flow emphasis remain legible.
- [x] #4 Task records, source and diffs use one reading layout with up to 80 text columns. Records scroll through every row and opening/closing a diff restores the exact reading position. Task definition remains before execution.
- [x] #5 Only hierarchy task status groups change map visibility with Space. Enter expands/collapses a status group and opens a task. Component task groups can browse, fold and open without changing visibility.
- [x] #6 The t and d keys open/focus hierarchy and details; repeating the focused pane key folds it. Tab switches available details tabs. Escape returns to the map without changing scope, with file/diff Escape first returning to the record. Arrows never change pane focus. Existing Advanced commands/Instructions reading controls remain intact.
- [x] #7 Backlog has a centered bordered recap outside the map canvas. Fresh tui-test evidence covers root, Scanner, actors, flows, task filters, long records and source/diff return at 120x36, 200x60 and 80x30. Focused behavior tests and bun run check pass and review findings are addressed.
- [x] #8 Task modified-file rows show Added, Removed, Modified or Unchanged status and added/removed line counts from the same shared diff data as the web. Diff rows show old/new line numbers, clear addition/removal markers and syntax colors from the terminal palette in light and dark themes.
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
1. Keep fixed-scale map geometry, bounded camera, narrow named neighbouring-container previews and a centered Backlog recap. Map browsing highlights only selection; explicit flows and tasks own connection emphasis. 2. Use t/d to focus or fold hierarchy/details, Tab for available detail tabs, Escape for reader return then map focus, and arrows local to the focused pane. What contains meaning, relationships and flow checkboxes; How contains technology and declarations in visible order. 3. Share grouped task rows with one status heading, full titles and pie progress beside exact counts. Hierarchy Space controls map visibility; Enter folds groups or opens records. 4. Share one reading layout up to 80 text columns. Keep task records wide across focus when space permits. Preserve record row and source scroll when returning from readers. 5. Load one shared task-diff payload for file status/counts and the diff reader. Share syntax tokens with the web; render old/new line numbers and change signs with terminal palette colors. 6. Verify supported navigation, record reading, file opening, return positions, task controls and map stability through focused tests and tui-test. Inspect light/dark palette previews, run bun run check, perform specification and quality reviews and the user-approved final full-context complexity review. Keep the task open for human visual acceptance.

Make reading scroll follow the selected row only at viewport edges, and route j/k through the same state as Up/Down so mixed input cannot bypass the reading cursor. Reproduce with a long task and verify mixed-key scrolling and exact reader return.

Center the root architecture vertically within the actual map viewport when it fits, preserving the existing horizontal framing and fixed world geometry. Verify resizing and selection do not disturb the centered scene; retain scrolling when the root is taller than the viewport.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Recovered the fitted TUI-owned root and container layouts while retaining Core sheet placement as semantic input. Root systems now render container rows with component blocks and work markers; container scope renders zones, component buildings, floors, routes and sibling peeks. Removed the obsolete fixed-sheet TUI adapter.

Verification: tui-test captured the opening root, stable Down/Up selection, Enter container, Backspace return and a 200x60 root under /private/tmp/groma244-tui-artifacts. The 120x36 opening frame matches the Terminal Facelift PDF, including the selected CLI row, centred Groma island and neighbour peeks. The lower empty canvas follows the approved sheet-row placement. Playwright rendered the captured SVG for visual inspection. Focused layout/navigation/projection/chrome/tree tests passed. Final bun run check passed: 104 Node tests and 272 Bun viewer tests. The first full rerun exposed one transient web-live timeout; the isolated file passed 8/8 and the next complete gate passed.

Reviews: the cold simplicity review found no blocking complexity and removed one unused export. The implementer specification and quality reviews found the accepted flow complete. The full-context complexity review found two possible default-selection paths; projection now delegates to the same first-root-row rule as initial navigation, with a regression test. No generic capability layer or compatibility path was added.

User-requested cold PDF/TUI review: all 12 PDF pages were read and the live TUI was exercised with tui-test at 120x36, 200x60, 100x36 and 80x36. Root/container structure, fixed-cell navigation, sibling crossing, startup width thresholds and complete green hierarchy selection match. Two material fidelity gaps await Alex's decision: lit routes have no on-map relationship labels, and the wide footer omits [ ] panes, / search, h history, p profile and ? keys. One beyond-PDF improvement also awaits decision: live resize keeps the startup pane set and clips at narrower widths, while the PDF specifies only which panes each width starts with.

Navigation correction: component arrows now use a strict 90-degree directional cone instead of reading order. Same-lane candidates remain preferred, and Left/Right retain sibling-container crossing only when no component remains in that direction. Component projection centers the selected building in both axes, while the terminal transition animates both camera coordinates. Root framing and task/flow attention are unchanged. Focused navigation, projection and large-world tests pass (the generated large-world fixture needs its established 10-second focused timeout and completed in 5.4 seconds). tui-test exercised Add -> Relation (Down) -> Agent instructions (Up) -> Group (Right) -> Agent instructions (Left); settled frames show each selected card centered at /private/tmp/groma244-centered-add.svg, /private/tmp/groma244-centered-down.svg and /private/tmp/groma244-centered-right.svg.

Final validation for the navigation correction: `bun run check` passed outside the sandbox, where watcher and localhost-server tests can run: 104/104 Node tests and 274/274 viewer tests. The cold reviewer read all 12 PDF pages, reviewed the diff, ran 28 focused checks, and exercised exact arrow sequences at 120x36 and 200x60. All four arrows selected only direction-valid components, every settled selection was centered, frame captures proved two-axis panning, world geometry remained fixed, and root behavior did not regress. Evidence is under /private/tmp/task244-cold-review/. The reviewer suggested optional distance-aware easing for long pans; this is beyond the PDF and has not been implemented.

Alex approved the interaction specification and both proposed choices: immediate flow selection and a dedicated component Tasks tab. Priority is human understanding of the map, relationships and flows. This supersedes the earlier strict-centering and centre-cone navigation criteria. Current audit evidence is /tmp/astra-groma-audit.md; rataflow custom-edge visual reference is /tmp/groma-rataflow-connections.png. TASK-246 modifies web files only and does not overlap this implementation.

Approved interaction refinement implemented: rectangle-edge proximity, bounded component follow, explicit pane focus and bracketed shortcuts, live pane fitting, immediate flow activation and full meaning, obstacle-avoiding routes with labels and lit endpoints, origin-consistent group frames, and a component Tasks tab sharing Work records/diffs/references. Focused gate: 54/54 tests across 8 TUI files; TypeScript passes; changed TUI code has no Biome warnings. Initial full check hit sandbox EMFILE; elevated run reached an existing scan-watch timing race (architecture files observed before onFold callback). Coordinator is performing fresh user-flow checks and arranging the cold review. No finalization or commit yet.

Cold simplicity review found two accepted-flow defects: the short Accept-to-Architecture-writer connection at 200 columns could lose its label, and a task record could not scroll below its last reference. Labels now also consider clear rows above/below endpoint cards; details scrolling can continue beyond the selected final link and return before changing links. Accepted comment and duplicate-border cleanups applied. Focused gate after corrections: 55/55 tests across 8 files, TypeScript passes, zero TUI Biome warnings. One targeted cold re-review requested. Full check is deferred until review and live QA processes finish to isolate existing watcher timeouts.

Targeted cold re-review passed both route-label and long-record scrolling fixes, including forward/back navigation, with evidence under /tmp/task244-targeted.Oa8iHR. Implementer specification and quality reviews passed the supported AC1–6 flow: entry/return, rectangle navigation, bounded camera, explicit pane focus, immediate flow and readable routes, shared task record/diff/reference path, and live resize. All changed source and test files stay within 500 lines; no TUI lint warnings, new dependencies, compatibility layers or unrelated implementation changes. AC7 remains pending the quiet full repository gate and final full-context complexity review. Task remains In Progress for human acceptance.

Final quiet repository gate passed: bun run check exited 0, with 104/104 Node tests and 279/279 Bun tests across 58 files. Log: /tmp/groma244-check-quiet.log. The earlier scan-watch timing failure and web-live timeout both passed independently and in this final run without parallel live-review sessions. Fresh 120x36 and 200x60 root/container/flow/work/resize evidence is under /tmp/groma244-current-120 and /tmp/groma244-current-200; component-task header/diff/reference checks and the targeted cold scroll/label checks also passed. Final full-context complexity review is the remaining handoff step; no commit, push or Done transition performed.

Objective acceptance evidence: AC1 — root/container fitted rows, groups and source-file floors verified by root-layout, container-layout and immutable projection tests plus /tmp/groma244-current-120 and /tmp/groma244-current-200 captures. AC2 — one-row rectangle-overlap regression, directional reachability, bounded-follow and stable-world tests pass; four-direction live navigation inspected. AC3 — explicit pane keys/focus and complete bracketed hints inspected at 120/200; live 120-to-80 shrink retains readable map space, and Enter opens details while folding hierarchy. AC4 — live flow-row selection immediately marks and lights the route/endpoints; full meaning, step and clear preserve architecture selection, backed by reducer tests. AC5 — live root flow and Core/Accept routes show direction, labels and lit endpoints; route-obstacle tests pass; observed group frames remain solid and patterns quiet. Targeted wide label proof: /tmp/task244-targeted.Oa8iHR/accept.svg. AC6 — component Tasks and global Work open the same record; live modified-file diff, architecture reference, prior-view restoration and corrected Work header pass. Record scrolling forward/back is verified at /tmp/task244-targeted.Oa8iHR/down35.svg, down95.svg and up60.svg. Quiet full gate: Node104/104 and Bun279/279 passed; earlier full-run web-live timeout passed isolated8/8 and this final full run. AC7 and DoD1 remain pending final full-context complexity review. Status remains In Progress; no commit or push.

Final full-context complexity review passed with no blocking architecture finding. The reviewer supports the current domain split and shared task-opening path. Non-blocking proposal for Alex only: approve a meaningful short-label wording policy; if approved later, place label geometry beside route projection so painting draws fixed positions. This proposal is not implemented. AC7 is verified by fresh 120x36/200x60/live-80x30 evidence, focused55/55, quiet full gate Node104/104 and Bun279/279, passed cold simplicity and targeted re-review, implementer specification/quality reviews, and final full-context complexity review. All acceptance criteria and Definition of Done evidence are recorded. Awaiting human visual acceptance; task stays In Progress with no commit or push.

Alex requested another human-QA pass and approved building it before further discussion. New scope: explicit flow checkbox activating root overview (keep one active flow), remove all surface patterns, definition-first task records, independent collapsible status groups with To Do above In Progress and initially collapsed/unselected, and arrow scrolling in welcome advanced/instructions views alongside existing j/k. Task-view scrolling stays as implemented. This supersedes immediate activation while browsing flow rows and quiet patterned surfaces; meaningful short-label policy remains outside this revision.

Human-QA refinement implemented: hierarchy arrows browse flow checkboxes; Space/Enter toggles a single root overview and x/uncheck restores the saved map selection. Launcher-command flows now light their full action path. All surface patterns and pattern-painting code are removed. Work and component Tasks share ordered status rows, folding defaults and explicit map toggles; delayed work initialization keeps In Progress visible. Full records place definition before execution. Welcome Advanced commands and Instructions use Tab list/reading focus with arrows plus existing j/k/page scrolling, and concise bracketed footers. Focused gate passed 81/81 across 11 files; TypeScript and targeted Biome passed. Fresh real CLI root/container/flow/folding/record/diff/long-scroll/live80 captures are under /tmp/groma244-refine-120 and /tmp/groma244-refine-200; reading captures are under /tmp/groma244-refine-reading. The small-screen footer was shortened after a captured clipping issue. Code is otherwise frozen for coordinator cold review; no implementation specification or quality review, full gate, commit or Done transition yet.

Quiet repository verification found three tests for superseded behavior: two required decorative surface patterns, and one expected browsing a relationship to activate it. Removed the obsolete surface-pattern test file and changed the existing relationship behavior test to prove that browsing stays inactive, Enter activates the relation, and a second Enter follows its endpoint. No runtime code changed. Focused navigation, routes, work-folding and source tests pass 26/26, including long records and exact diff return. The affected files and architecture references were recorded immediately. A fresh full repository check remains required.

Current human-QA revision: final verification and handoff

The cold review found that Down skipped a long task definition to the first link. Record navigation now reads each rendered row, with exact link IDs carried in PaneLines.ids so wrapped files with the same prefix remain distinct. Opening a diff saves the reading row; restoring it scrolls again after the rendered frame has its final height. The targeted review passed: before-diff and after-Escape text, SVG and PNG hashes match, and the intervening diff and restored record were visually inspected. Evidence: /tmp/groma244-record-review/.

Current acceptance evidence:
- AC1: navigation, projection, root/container layout, large-world, chrome and tree tests pass in the final full check. Fresh root/container and narrow-view captures at /tmp/groma244-refine-120/ and /tmp/groma244-refine-200/ show fitted geometry, fixed scale, bounded camera and explicit pane focus.
- AC2: navigation tests prove browsing leaves the active flow and container scope unchanged; Space/Enter selects one flow at root and clear restores the saved selection. Launcher flow tests cover the full path across containers. Captured flow-browse, flow-root, flow-step, flow-uncheck and flow-return views in both refinement directories verify checkboxes, meaning and highlighted endpoints.
- AC3: fresh root/container captures show plain actor, system, container and group surfaces while shapes, frames, glyphs and green emphasis retain their roles. Removed the obsolete 96-line surface-pattern test file; no replacement decorative assertions were added.
- AC4: shared component/global record-opening tests prove the same record, modified-file diff and architecture reference path. Definition-order and long-record tests cover every row before and after links, both same-prefix file targets, and exact diff return. Fresh record top, middle-definition, first-file, diff and diff-return captures are in /tmp/groma244-record-review/.
- AC5: work and work-folding tests prove To Do-first ordering, collapsed To Do/Done, expanded In Progress, initial map visibility, independent folding and map toggles, and moving a hidden task cursor to its header in both lists. Fresh Work and work-fold captures verify the visible defaults and folding.
- AC6: welcome tests prove Tab switches arrow reading/list navigation, Up/Down match j/k reading movement, and launcher selection remains usable. Advanced/Instructions list, reading and return captures are in /tmp/groma244-refine-reading/, including a narrow view. Existing page keys remain supported; task reading has no j/k binding.
- AC7: the fresh 120x36, 200x60 and live 80x30 evidence, passed cold review and targeted correction check, implementer specification/quality reviews, final full-context review, and final repository check cover the supported flow.

Final verification: focused routes/navigation/work-folding/source checks passed 26/26 after correcting the obsolete browsing-preview assertion. The test now proves browsing stays inactive, Enter lights the relation, and a second Enter follows its endpoint. Final quiet bun run check exited 0: Node 104/104 and Bun 283/283 across 58 files; log /tmp/groma244-refinement-final-check.log. The nine existing complexity warnings are outside this task's changed files. No runtime code changed during the final obsolete-test correction.

Definition of Done evidence: all current acceptance criteria have the objective evidence above; full checks pass and changes are task-scoped; docs/viewers/tui/index.md, docs/viewers/tui/interaction-spec.md and docs/product-model.md describe the implemented controls; the plan matches the final solution and these notes record corrections and verification. Modified-file traceability and exact architecture references are complete. All task source/test files remain at or below 500 lines (largest: 487). Final specification, quality and full-context reviews have no blocking finding. The only final advisory was stale Work comments, deferred until those lines are next touched.

Ready for Alex's visual review. Status remains In Progress; no commit or push.

Taken over in the shared main workspace after Alex reported nine remaining TUI issues: awkward bracket pane keys; Tab conflicts with details tabs; inconsistent actor flow/relationship naming; weak Backlog recap visibility; explicit pane focus and Escape return; unclear Scanner container map; hierarchy-only task visibility toggles with Enter folding and Space toggling; broken task scrolling; and insufficient file/diff reading width. Previous acceptance evidence does not establish this latest human-QA revision. Reopened affected acceptance and completion checks. Preparing one coherent interaction proposal before changing key, naming, layout or reading contracts. TASK-247 recorded files are web-only and do not overlap the TUI work; no coordination message sent.

Alex clarified the neighbouring-container proposal: retain small previews rather than removing them. Show only a few lines of neighbouring containers, reserving most of the viewport for the active container. Names should read vertically for previews at the left/right edges and horizontally for previews above/below. This supersedes the proposed removal of neighbouring-container previews; it does not authorize broad architecture-content curation.

Alex approved the interaction proposal with narrow named neighbouring-container previews. Source and diff width, focus and task-reading changes share the existing terminal layout and navigation domains; no changes to web or architecture meaning are in scope.

Latest takeover revision verified: t/d focus and fold panes, Tab stays in available details tabs, Escape returns map focus, and map arrows remain usable after folding the Backlog hierarchy. Actor details share Flows and checkbox state. Only hierarchy Space changes task visibility; Enter folds status groups in either list. One layout supplies up to 80 reading columns to records, source and diffs, while one rendered record row owns scrolling and link opening. Neighbour previews are three-column named strips. Backlog owns a centered bordered recap and its shortcut. Documentation describes these controls.

Fresh evidence: /tmp/groma244-takeover.1kfUEK/qa-200 contains root, Scanner, actor/flow, source, record and map-return captures. qa-120 contains wide source and record captures. qa-extra contains live 80x30 resize, hierarchy status folding/filtering, narrow record forward/back, and a 120-column modified-file diff. Record top/return text matches at 120, 200 and 80 columns; before-diff and after-Escape text match exactly. Diff screenshot was visually inspected. Some earlier multi-step QA attempts were discarded because captures preceded processed input; the named stable captures and explicit return comparisons establish the final evidence.

Final bun run check passed: 104 Node tests and 291 Bun tests across 58 files; log /tmp/groma244-takeover.1kfUEK/check-final.log. Nine pre-existing complexity warnings remain outside this task. All changed TUI/source test files stay under 500 lines. Specification and quality review corrected actor Tab cursor loss and map arrows being swallowed after folding Work. The approved full-context reviewer supports the domain split and single record-row authority; its Help/Profile Escape finding was fixed and tested. Removed its identified unused snapshot focus, fixed-width export, duplicate pane-key dispatch and an orphan comment. No material architecture recommendation remains. Per today’s no-general-subagents instruction, no additional review agent was spawned beyond Alex’s approved final full-context review.

Scanner still contains metadata-only architecture descriptions and duplicate-looking names; this is authored/scanned content, not changed by the approved layout revision. Ready for Alex’s visual acceptance. Task stays In Progress; no commit or push.

Alex reports that exiting the code view leaves details expanded and scrolling broken. Reopening reader-return verification and tracing both source-to-How and task-diff-to-record. File status/counts and terminal-palette diff colors are also requested; the concrete A/M/D and palette proposal is awaiting the ongoing co-design response.

Alex explicitly requests that navigating the map must not highlight connections. The painter currently treats routes touching currentId as lit; remove that trigger while retaining explicit flow/work highlights and the selected card.

Alex approved the supplied screenshot as a useful wide task layout when enough terminal space is available. Keep the 80-column task pane while browsing other panes when hierarchy plus readable map still fit. This separates the desired width from the reported code-return scrolling defect; scroll input method is being clarified.

Map-navigation correction implemented by deleting currentId from route-lighting eligibility. Explicit flow and work emphasis remain. Existing route paint regression now proves selecting a connected card leaves the route thin, while explicitly selecting its flow lights it. Fresh real root/container arrow captures under /tmp/groma244-takeover.1kfUEK/qa-extra/quiet-* were inspected. Open task records now retain 80 text columns across focus changes when the selected hierarchy and at least 40 map columns fit. Focused route/chrome tests pass 18/18 and route/navigation tests pass 19/19. Latest full checks passed Node 104 and Bun 290/291 but twice timed out in the web architecture-Markdown live-update test; isolating that unrelated test. Task remains open for requested file facts/colors and code-return scrolling clarification.

Final quiet full rerun still timed out only in the web architecture-Markdown live-update test: Node104 pass and Bun290/291. That web test file passed independently8/8 immediately before the rerun. Logs: /tmp/groma244-takeover.1kfUEK/wide-task-final-check.log and web-live-isolated.log. No unrelated web changes made; current reader-return and file-summary requests remain open.

Alex supplied light and dark terminal/web diff screenshots as the approved comparison. The web examples establish readable old/new line numbers, addition/removal separation and syntax treatment. Implementing that treatment through terminal palette intents, plus the already requested per-file status and line counts. TASK-249 modifies web/page.ts and docs/viewers/web/index.md only; these files do not overlap this change.

Alex supplied a How-pane screenshot where Up cannot move from Flows through back into Code. Confirmed that navigation concatenates flow stops before declarations while rendering puts Code first. Correct the cursor order to match the view. Recommended moving flow participation to What as a semantic design choice; that section move is not yet implemented.

Alex approved moving Flows through from How to What. How will contain code/technology; What will contain meaning, relationships and flow participation. Also explicitly requested removing repeated status text from task rows under status group headings and adding pie progress glyphs beside the exact completed/total count.

Latest revision: What now owns component flow participation with single-flow checkboxes, while How owns technology and declaration navigation. Flow commands are separated from genuine relationship rows so each command has one cursor stop and toggles rather than following on a second Enter. Grouped task rows show the status only in their heading and pie progress beside exact counts. Shared task-diff data supplies A/D/M/unchanged facts, counts and the file reader; web and terminal share syntax tokenization. Terminal gutters use bold palette red/green with old/new line numbers and change signs. Source Escape restores its prior How scroll, and diff Escape retains the exact record row. Ordinary map selection leaves routes unlit; wide task records remain wide across focus when sufficient space exists.

Verification: 24 focused navigation/source/work-folding tests passed. Final bun run check passed with 104 Node tests and 292 Bun tests across 58 files; log /tmp/groma244-takeover.1kfUEK/final-verified-check.log. Earlier simultaneous live QA runs hit live-update watcher timeouts; the quiet full gate passed. Fresh real terminal captures under qa-diff-dark verify file facts, visible numbered/color-coded diff gutters, grouped pie rows, wide focus and byte-identical record text after diff return. Captures under qa-extra/final-* verify What/How separation, source opening and normal pane restoration. Light and dark palette previews were inspected from actual diff line chunks; tui-test ignores requested terminal palette changes, so these are palette previews rather than a claimed live light-terminal capture. Inverse-video gutters were removed after a real capture exposed hidden glyphs. Specification/quality and local simplicity review found no supported-flow blocker. The user-approved final full-context reviewer found no material architecture recommendation; shared data, navigation and rendering responsibilities are clear. General review subagents were not used under the user restriction. Documentation and the implementation plan match the final flow. Ready for human visual acceptance; no commit or push.

Edge-follow and mixed-input revision: the toolkit scrollbar had an independent j/k handler that moves by one fifth of a viewport. Groma now maps j/k to the same Up/Down actions and prevents default toolkit key handling. Hierarchy and detail cursors preserve their viewport offset while visible, moving the viewport only at its edges. Reading views retain their base offset across a temporary source or diff. A renderer regression with an explicitly focused scrollbar verifies alternating arrows/j/k, stable offsets within the viewport and travel back to the top; the existing diff-return test now opens a file away from the bottom edge and verifies exact restoration after layout settles. Focused checks passed 27/27. Real tui-test mixed-key captures edge-before/edge-after have identical text with only the selected row moving; file-list/record-return are identical after diff close. Evidence: /tmp/groma244-takeover.1kfUEK/qa-diff-dark. Local simplicity/specification/quality review and the user-approved final full-context review found no blocking issue or material recommendation. Final bun run check passed 104 Node and 293 Bun tests; log /tmp/groma244-scroll-quiet-check.log. An earlier full run timed out in the unrelated web live-update test, which passed 8/8 independently and then in the final full run. Documentation updated. Task remains open for human visual acceptance; no commit or push.

Root centering revision: fittedCamera centers the root vertically when its displayed world fits inside the actual map viewport. Existing horizontal framing, fixed world geometry and oversized-root scrolling remain. A fixture regression failed before the change and now proves equal upper/lower space across actor/system/container selection and 36/60/30 terminal heights. Focused projection/root-layout/chrome tests passed 25/25. Real tui-test root, arrow and container captures under /tmp/groma244-takeover.1kfUEK/qa-extra/quiet-* were inspected; the root sits in the map center above the Backlog strip. Local simplicity/specification/quality review and final full-context review found no blocking issues. The centering condition lives in the existing fittedCamera helper to keep projectWorld within the complexity limit. Final bun run check passed: 104 Node and 294 Bun tests; /tmp/groma244-center-check.log. Task remains open for human acceptance; no commit or push.

Alex accepted the completed terminal view and authorized marking the task Done, committing and pushing.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restored the approved terminal map and reading workflow: centered root, bounded container navigation and previews, explicit pane focus and flow controls, grouped task progress, shared task records and palette-aware file diffs, and stable edge-follow scrolling with unified arrows/j/k. Verified through live tui-test captures, focused regression tests, local specification/quality/simplicity reviews and the approved final full-context reviews. Final bun run check passed 104 Node and 294 Bun tests (398 total). Accepted by Alex.
<!-- SECTION:FINAL_SUMMARY:END -->
