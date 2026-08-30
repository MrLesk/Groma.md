---
id: TASK-221
title: Search architecture from TUI and Web
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 17:06'
updated_date: '2026-08-30 20:55'
labels: []
dependencies: []
references:
  - search
  - navigation
  - terminal-painting
  - popover
  - revision-history
  - web-shell
  - control
  - session
  - view
  - stats
modified_files:
  - package.json
  - bun.lock
  - src/search.ts
  - test-bun/search.test.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/tui/paint.ts
  - test-bun/navigation.test.ts
  - src/viewers/web/atoms/popover.ts
  - src/viewers/web/revision/view.ts
  - src/viewers/web/search/view.ts
  - src/viewers/web/search/control.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - test-bun/web-search.test.ts
  - src/viewers/web/search/session.ts
  - src/viewers/web/chrome/stats.ts
  - groma/observed/systems/groma/containers/cli/components/search.md
  - groma/observed/systems/groma/containers/core/components/search.md
  - design-qa.md
  - groma/observed/systems/groma/containers/web-viewer/components/control.md
  - groma/observed/systems/groma/containers/web-viewer/components/session.md
  - groma/observed/systems/groma/containers/web-viewer/components/view.md
  - groma/observed/systems/groma/containers/web-viewer/components/popover.md
  - groma/observed/systems/groma/containers/web-viewer/components/stats.md
priority: high
type: feature
ordinal: 234000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Human architects and coding agents can find semantic architecture elements from either viewer through one Fuse.js-backed core search contract. The selected Web design keeps search in the top application chrome: an expanding header input with a compact anchored results dropdown. The existing revision selector is restyled through the same reusable anchored-popover design so both controls belong to one visual system.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The shared core returns the same ranked architecture element results to TUI and Web for the same world and query, using Fuse.js over semantic fields and returning kind, origin, and ancestor context for disambiguation
- [x] #2 In both viewers, slash opens search, Up and Down preview results, Enter keeps the current result, and Escape restores the selection, scope, and camera that existed before search
- [x] #3 The Web viewer also opens search with Cmd+K on macOS and Ctrl+K elsewhere, while slash remains normal text input when another editable control has focus
- [x] #4 The Web header expands Search into the approved anchored dropdown design, shows a compact ranked result list, and previews the current result without changing map geometry
- [x] #5 Accepting a Web result uses the existing architecture selection and URL behavior; changing the displayed revision rebuilds search against that revision only
- [x] #6 The Web revision selector uses the same anchored-popover visual component as search without changing its revision behavior
- [x] #7 Tests cover shared ranking behavior and viewer navigation state without asserting decorative copy or exact Fuse.js scores
- [x] #8 Web search keeps every ranked match available, shows five complete rows before scrolling, and has no vertical scrollbar when the query returns five or fewer results
- [x] #9 Opening and closing Web search transitions the trigger and input smoothly without delaying focus or cancel restoration, and reduced-motion preferences disable the transition
- [x] #10 The Web search footer keeps a small visual inset from the popover border
- [x] #11 Arrow-key search preview changes only the map highlight and camera; it does not change hierarchy selection, details visibility/content, source view, or URL until Enter commits through normal architecture selection
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
1. Add one Fuse.js-backed architecture search core that indexes stable semantic fields and returns ranked elements with ancestor context.
2. Replace the TUI's local name filter with the shared search core while preserving live preview, accept, cancel, scope, and camera behavior; rename filter vocabulary to search.
3. Add one reusable anchored-popover Web atom and move the revision selector onto it without changing revision behavior.
4. Build the selected expanding header search control and integrate it with Web selection, URL commit, shortcuts, and world/revision refresh. Keep arrow-key preview as map-only attention and camera reveal; Enter alone commits the normal selection that synchronizes hierarchy, details, source, and URL.
5. Treat five results as the visible Web window rather than a search cap: keep all ranked matches available, fit five complete rows without a scrollbar, and scroll only for additional matches.
6. Animate the Web search trigger, input, and result menu in both directions using the existing chrome motion tokens, disable the transition for reduced-motion preferences, and keep the footer slightly inset from the popover border.
7. Verify core and viewer state with focused tests, run bun run check, compare the live Web state to the approved mock and correction screenshots, then run the required simplicity and final reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one deterministic Fuse.js core over name, id, ancestor path, and description; both TUI and Web consume that core. TUI stores ranked matches in navigation state and restores its saved view and camera on Escape. Web separates DOM control, transient selection/camera session, and result view inside the search domain; Enter commits through existing selection and URL state, and revision updates rebuild the index from the displayed world.

Browser QA at 1280x720 verified slash, Cmd+K, live Arrow preview without URL mutation, exact Escape restoration of selection/camera/URL, Enter URL commit, and the shared search/revision anchored-popover design with no browser warnings or errors. design-qa.md records the passed comparison against the approved mock.

Cold simplicity review removed the exported TUI search adapter, collapsed duplicate query branches, and moved search-only footer/keycap CSS out of the shared popover atom. The requested full-context complexity review approved the domain boundaries and found one contract mismatch: Meta+K and Ctrl+K were both accepted on every platform. Corrected the pure shortcut rule and tests so macOS accepts only Cmd+K and other platforms only Ctrl+K.

Verification: TypeScript passes; 35 focused shared-search, TUI navigation, Web shortcut, chrome, details, and URL tests pass; task-scoped diff check passes. bun run check reaches the Node suite but remains blocked by the shared watch-test resource failure: groma scan --watch returns no output and watchScan reports EMFILE (88/90 Node tests pass). No TASK-221 failure or warning was found; targeted lint reports only the two pre-existing broad TUI navigation complexity warnings.

User correction after preview: five is the intended visible result window, not a hard result cap. The Web menu must fit five complete rows and its footer without a scrollbar, while additional ranked matches remain reachable by scrolling.

Result-window correction verified at 510x366: exactly five results occupy five 50px rows with clientHeight equal to scrollHeight (250px), so no scrollbar appears. A 46-result query scrolls only the result list; selecting result six moves it by 50px while the footer coordinates remain unchanged. A new query resets the list to scrollTop 0 so its first active result stays visible. Browser warnings and errors were empty.

The requested full-context complexity review approved the five-row viewport inside the Web search domain and recommended removing the unused optional limit from ArchitectureSearch.find(). Removed it so the shared core always exposes all ranked matches and no interface can accidentally reintroduce a private cap.

Post-correction verification: 35 focused search, TUI navigation, Web shortcut, chrome, details, and URL tests pass; TypeScript and task-scoped lint/diff checks pass. bun run check still reaches the same unrelated shared watch-test resource failures (88/90 Node tests; groma scan --watch has no output and watchScan reports EMFILE). design-qa.md contains the same-size correction comparison and remains passed.

User correction after preview: opening and closing Web search must animate. Keep motion inside the search view, reuse the existing chrome motion tokens, preserve immediate focus/cancel behavior, and disable the transition when reduced motion is requested.

User correction from the footer capture: keep a few pixels of space between the keyboard footer and the popover border instead of letting the footer sit directly on it.

User correction after preview: Arrow navigation is map-only attention. It may reveal and highlight the result on the map, but hierarchy selection, details/source panes, and URL stay on the committed state. Enter alone clears source if needed and commits the result through normal architecture selection.

Final interaction QA: at 510x366, five results occupy 250px with clientHeight equal to scrollHeight; the 300px menu content fits exactly and leaves a 5px footer inset. Opening and closing use matching 182ms chrome keyframes, and reduced motion disables animation. Browser state inspection proved Arrow preview changed only the selected SVG element while hierarchy, details, source state, and URL stayed committed; Enter then synchronized map, hierarchy, details, and URL through normal architecture selection. The 35 focused search/navigation/chrome/details/URL tests pass. bun run check still has only the known shared watch-test resource failures: 88/90 Node tests, empty groma scan --watch output, and EMFILE from watchScan.

Final full-context complexity review approved the domain split and the map-only preview versus Enter commit boundary. Applied its three in-scope simplifications: renamed the integration callback to previewMap so its invariant is explicit, corrected the session comment to describe transient map preview and the cancel snapshot, and removed redundant field/menu transitions because keyframes fully own those animations. Source/file restoration remains outside the search session because preview never mutates source and Enter explicitly clears it. The reviewer found no larger refactor warranted and judged the architecture junior-safe. Post-review lint, TypeScript, and all 35 focused tests pass.

Post-overlap verification: TASK-220 added selected Work detail loading in the shared TUI host/model/paint path without changing TASK-221 search logic. TypeScript and all 35 focused shared-search, TUI navigation, Web shortcut, chrome, details, and URL tests still pass against the combined workspace.

Wrap-up verification: the repository-wide bun run check now passes completely (lint with existing warnings only, TypeScript, 91 Node tests, and 195 Bun tests). Fresh browser QA on the combined current build verified ranked search results with ancestor context, map-only preview, Enter commit to ?component=sheet-routing, the conditional Tasks tab, and an empty browser console. The required final complexity review approved the shared core and Web Control/Session/View split, with no authority-backed feature blocker. Control, Session, and View are grouped under Search; Popover and Stats are grouped under Web chrome. Its optional proposal to rename those already grouped observed IDs was not applied because the visible domain grouping and descriptions already disambiguate them without extra source churn.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added one Fuse.js architecture search contract shared by TUI and Web. Both viewers use the same semantic ranking and reversible preview flow; Web keeps preview limited to map attention and camera until Enter commits normal selection and URL state. Added an expanding header search with a five-row scrolling result window, reduced-motion support, and a shared anchored popover also used by revision selection. Grouped the atomic Web parts by Search and Web chrome, updated architecture and QA evidence, and passed focused browser checks, the full repository check, and the final complexity review.
<!-- SECTION:FINAL_SUMMARY:END -->
