---
id: TASK-192
title: Browse historical Groma revisions from the web header
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 18:49'
updated_date: '2026-08-27 20:36'
labels: []
dependencies: []
references:
  - git
  - web-server
  - world-loader
  - project-profile
  - page
  - render
  - project-editor
modified_files:
  - src/history/git.ts
  - test-bun/git-history.test.ts
  - src/viewers/web/payload.ts
  - src/viewers/web/server.ts
  - src/viewers/web/page.ts
  - src/viewers/web/url.ts
  - src/viewers/web/revision/control.ts
  - src/viewers/web/render.ts
  - test-bun/web-page.test.ts
  - test-bun/web-url.test.ts
  - test-bun/web-live.test.ts
  - docs/viewers/web/index.md
  - src/viewers/web/revision/view.ts
type: feature
ordinal: 204000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An architect can use a compact revision control in the web header to move between the live working-tree architecture and Git commits that changed the groma/ Markdown tree. A historical selection renders that complete Groma snapshot as a clearly identified read-only world without checking out the commit, changing repository files, or mixing it with current architecture or work state. The first slice covers the current branch and snapshots compatible with the current Markdown contract; comparison, restoration, other refs, TUI history, and legacy compatibility are outside scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The header defaults to Current and lists newest-first commits on the current branch whose groma/ tree changed, identified by short hash, date, and subject
- [x] #2 Selecting a listed commit renders the complete compatible groma/ snapshot from that commit without changing the branch, index, working tree, or repository files, and never combines historical Markdown with current source measurements
- [x] #3 Historical mode clearly names the selected commit, is read-only, omits current Backlog work, and stays on that snapshot while live working-tree updates continue
- [x] #4 Selecting Current returns to the live working-tree world and resumes its architecture and work updates
- [x] #5 The selected revision is carried in the URL, a refresh or copied link restores it, and switching revisions refits the map and clears architecture-specific selections, flows, and tasks
- [x] #6 The revision control uses Groma-styled header chrome rather than a native dropdown, matches the Fit control's height and visual weight, and presents commit metadata in a readable menu
- [x] #7 Commits whose groma/ Markdown does not satisfy the current contract remain visible in chronological history but are disabled and clearly marked Unsupported; direct URLs fail explicitly without adding legacy parsing
- [x] #8 After choosing an available revision, the menu closes and releases focus immediately, while the revision icon shows a loading indicator until the selected world is applied
- [x] #9 The live working-tree choice is labelled Current revision in both the closed control and the revision menu
- [x] #10 While a revision is loading, the closed control replaces the revision label with Loading and three animated dots without changing its size
- [x] #11 Each Git revision row uses two lines separated from its neighbours: the commit subject first, then an optional exact tag, short commit id, and commit date with time formatted in the browser's current locale
- [x] #12 The revision menu uses a minimal scrollbar whose thumb remains visible in every Groma theme
- [x] #13 Hovering a Git revision row shows a Groma-styled tooltip only when the commit body is non-empty; the tooltip contains the complete body without repeating the subject
- [x] #14 Clicking or pressing outside the open revision control closes its menu
- [x] #15 The revision chevron has clear spacing, remains visually centered, and animates between closed and open directions
- [x] #16 The menu rows use compact right spacing; only the Current revision row's top-left corner and the final row's bottom-right corner are rounded
- [x] #17 Reopening the menu while viewing a historical revision leaves that revision selected until the architect explicitly chooses another row
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
1. Add one Git-history domain module that lists current-branch commits which changed groma/ and materializes a selected full-repository snapshot without checkout, index, branch, or working-tree changes.
2. Keep Core as the sole architecture authority by loading both live and historical repository roots through the existing profile, architecture, source-measurement, and sheet pipeline.
3. Extend the web payload and URL state with one validated revision identity; render a compact header selector for Current and newest-first commit metadata.
4. On revision changes, fetch one complete payload, clear architecture/work/flow state, refit the map, hide edit and work affordances in history, and ignore live events until Current is restored.
5. Add focused Git-history, server, page, URL, and browser-state tests; run bun run check and visual browser QA.
6. Run the required cold simplicity review and full-context architecture review before finalization.

7. Give revision loading an immediate closed, unfocused, busy state in the existing revision-control owner; swap only the history icon for a spinner and verify the full interaction in the browser.

8. Label the live state Current revision and keep the fixed-width header label stable while Loading with animated dots; stop motion for reduced-motion users.

9. Extend the Git revision contract with ISO commit time, complete message, and one deterministic exact tag; move revision markup/CSS into the revision domain, render two-line separated rows, localize timestamps in the browser, and add one unclipped domain tooltip plus a minimal theme-safe scrollbar.

10. Refine the existing revision control: close it on outside pointer input, represent tooltip text as commit body only, space and animate the centered chevron, and make only the menu's top row corners round.

11. Constrain revision selection to owned menu buttons, replace the clipped ellipsis with three fixed animated dots, and refine row spacing and asymmetric menu corners; reproduce and verify reopening historical mode.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Final verification: bun run check passed (81 Node tests, 185 Bun tests, TypeScript, and Biome with only the repository's existing 43 warnings); git diff --check passed. Browser QA verified Current and historical switching, direct revision restoration, reset/refit behavior, hidden editing and work state in history, disabled Unsupported revisions with explicit HTTP 422 direct responses, clean console, and exact header alignment: revision and Fit controls both top 19px and height 32px. Cold simplicity, targeted compatibility re-review, final specification review, and final code-quality review passed with no blockers.

Revision selection now enters its busy state before network work: the menu closes, the selected option loses focus, repeated selection is blocked, the history icon swaps to a reduced-motion-aware loader, and the busy state lasts through applying the selected world.

The live working-tree choice now uses one rendered source label, Current revision, which the controller reads back for live updates. During loading, the fixed-width label area shows Loading with a non-shifting animated ellipsis; reduced-motion mode shows the three dots without animation.

The final cold review found the header control shrank from the wider Current revision state to the minimum width during Loading. Both label states now own the same fixed 16ch slot, so live, loading, and historical labels keep one control width.

Final loading-state verification: a real browser selection showed the menu closed, zero focused descendants, aria-busy true, history icon hidden, loader visible, and Loading... in the accessibility snapshot. Completion cleared busy state and restored 56aa130 plus the full-SHA URL. Browser measurement proved Current revision, Loading..., and 56aa130 all keep the same 173.59375px control width. Console was clean. The final bun run check passed with 81 Node and 187 Bun tests; only the repository's existing 43 Biome warnings remain. Cold simplicity, width-fix re-review, and full-context architecture review passed with no blockers.

Git revision metadata now carries an ISO commit timestamp, complete commit message, and the first deterministically sorted exact tag. Revision markup and CSS moved from page.ts into revision/view.ts; the controller localizes timestamps, owns one body-level unclipped tooltip, and now accepts named options instead of six positional arguments. Rows use two lines and theme-derived separators and scrollbar colors.

Cold review corrections: the full-message tooltip is now scrollable and hover-stable instead of clipping at 240px; the named-options call was compacted so render.ts stays at 500 lines; exact copy and HTML-shape assertions were removed from the page test while Git metadata behavior remains covered in git-history.test.ts.

Final repository validation after history-row review fixes: targeted lint found no issues; focused Git/page/URL/server tests passed; bun run check passed with 81 Node and 187 Bun tests; git diff --check passed; simplicity and full-context targeted re-reviews passed. The in-app browser opened localhost but then its URL safety policy blocked further inspection, so the two-line layout, hover tooltip interaction, and scrollbar visibility across light/dark/blueprint remain awaiting visual confirmation. ACs 11-13 and Definition of Done remain unchecked until that evidence exists.

Latest revision-control refinements: document-level pointer input closes the open menu; the chevron has an optically adjusted 160ms open/close transform with reduced-motion support; Git subject and body are separate, empty bodies render no tooltip attribute, and tooltip content uses only the body; the semantic Current revision row owns rounded top corners with square lower corners. Defensive review cleanup renamed the revision field and DOM attribute from description to body and replaced positional :first-child styling with .revision-option.current. Focused lint, typecheck, git diff validation, and 21 Git/page/URL/live-web tests passed. Final bun run check passed with 81 Node and 187 Bun tests; only the repository's existing 43 Biome warnings remain. Cold simplicity review and full-context architecture review passed; the targeted cleanup re-review found no regressions. Browser inspection is still blocked by the in-app URL safety policy, so outside-click interaction, one-pixel chevron alignment/animation, tooltip hover, and corner appearance remain visually unverified; ACs 11-16 and Definition of Done remain open.

Final revision-control regression evidence: the click handler and selected-state painter now share the owned  boundary, so the summary and body history marker cannot select Current. Browser QA selected 56aa130, reopened the menu, and preserved its full-SHA URL, label, and aria-current state; only an explicit second row changed to 81806ac. Outside click closed the menu without changing the selected revision. Loading rendered three fixed 7.21875px dots whose opacity moved independently, with no clipped glyphs or width change. Computed row styles showed 5px right padding, Current top-left 6px with its other corners square, and the final row bottom-right 6px. Commit-body hover showed the complete body without its subject; a bodyless row showed no tooltip. The 4px scrollbar thumb was visible in Light, Dark, and Blueprint screenshots and had theme-derived computed colors. The chevron had distinct open/closed transforms and a 160ms transition. Browser console was clean. Focused revision tests passed 21/21; the final shared bun run check passed with 81 Node tests and 189 Bun tests after one unrelated watcher timeout passed alone and on rerun. Cold simplicity and full-context architecture reviews passed; the one accepted consistency cleanup passed targeted re-review. TASK-192 is ready for Alex's acceptance but remains In Progress, uncommitted, and unpushed until he confirms it is done.

Clarification: the shared ownership boundary is the revision-option button selector carrying data-revision; both click handling and selected-state painting use that same boundary.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-08-27 18:57
---
Alex refined the approved UI during browser QA: replace the native select with a custom menu and size its closed control like the header's Fit button.
---

created: 2026-08-27 19:07
---
Browser measurement confirmed the revision summary at top 20px and Fit at top 19px, both 32px high. Applied the Fit group's existing -1px header alignment to the revision control.
---

created: 2026-08-27 19:12
---
Alex chose to keep the full Git timeline and mark obsolete Markdown revisions as unsupported. The implementation must validate with the current contract only; it must not add legacy parsing.
---

author: @alex
created: 2026-08-27 19:39
---
Alex accepted the same-commit loading cost and requested explicit waiting feedback: close and unfocus the menu immediately, then show a loading indicator in place of its history icon.
---

author: @alex
created: 2026-08-27 19:46
---
Use “Current revision” for the live working-tree label in both the closed selector and its menu row; historical selections continue to show the short commit hash.
---

author: @alex
created: 2026-08-27 19:47
---
During revision loading, show “Loading” with animated ellipsis dots in the closed control; restore the selected revision label after application.
---

author: @alex
created: 2026-08-27 19:55
---
Render history rows on two lines: subject, then optional exact tag · short id · local date/time. Hover shows the complete commit message. Use the smallest practical theme-visible menu scrollbar.
---

author: @alex
created: 2026-08-27 20:11
---
Close the menu on outside clicks; space, center, and animate the chevron; show tooltips only for non-empty commit bodies; and keep only the Current revision row's top corners rounded.
---

author: @alex
created: 2026-08-27 20:22
---
Alex reproduced a historical-mode regression: reopening the revision menu selects Current revision. He also requested tighter right spacing, only top-left and final bottom-right row corners, and stable animated loading dots.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Git-backed revision history to the web header with compatible snapshot loading, stable URL restoration, historical read-only state, custom two-line revision rows, loading feedback, commit-body tooltips, theme-visible scrolling, and defensive menu ownership. Browser QA covered Current and historical switching, reopening without reset, outside dismissal, loading animation, tooltip gating, row corners, and all themes. Final verification passed with 81 Node tests, 189 Bun tests, TypeScript, Biome, cold simplicity review, and full-context architecture review.
<!-- SECTION:FINAL_SUMMARY:END -->
