---
id: TASK-142
title: Refine Backlog task panel states and interactions
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 16:03'
updated_date: '2026-08-23 18:16'
labels: []
dependencies: []
references:
  - render
  - iso-camera
modified_files:
  - src/viewers/web/work/island.ts
  - docs/viewers/web/index.md
  - src/viewers/web/work/selection.ts
  - src/viewers/web/render.ts
  - test-bun/work-selection.test.ts
  - src/viewers/web/iso/camera.ts
  - test-bun/web-task-camera.test.ts
type: enhancement
ordinal: 153000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refine the web viewer's Backlog task panel as one coherent work surface. Its folded and open presentation uses the agreed grayscale mark, two-line heading, spacing, glass, border, shadow and motion. Active task chips use the green pill outline without repeating the pin's badge circle; the selected sidebar task adds bold text. Task clicks switch selection directly among active tasks and deactivate only the already-selected task. The camera fits the combined touched bodies and highlighted outgoing routes of every active task with a wider context margin.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The folded task panel's Backlog mark is grayscale.
- [x] #2 The open task panel shows Backlog.md on the first line and Tasks on the second line.
- [x] #3 The task panel uses a 35% paper mix over its existing blur.
- [x] #4 In the open task panel, the Backlog mark spans the full height of the two-line heading.
- [x] #5 The open heading has 8px left padding.
- [x] #6 The open heading's Backlog mark remains grayscale.
- [x] #7 The panel has a 1px 8%-ink border and a downward 0 4px 8px shadow at 5% black.
- [x] #8 The open heading has 4px extra space before the first status filter without changing spacing between filters or task chips.
- [x] #9 An active task chip has no green circle around its badge; the green circle remains on the map pin.
- [x] #10 The panel size transition and chevron rotation both complete in 300ms.
- [x] #11 Every active task chip uses the accent pill border and accent text, not colour alone.
- [x] #12 The selected task shown in the sidebar uses bold chip text while retaining the active pill treatment.
- [x] #13 Clicking an inactive task activates it and selects it in the sidebar.
- [x] #14 Clicking an active task that is not selected keeps every active highlight and switches the sidebar selection to that task in one click.
- [x] #15 Clicking the selected task deactivates it and selects the most recently activated remaining task, or clears task selection when none remain.
- [x] #16 Activating or deactivating a task centres the camera on the combined touched elements of every active task.
- [x] #17 Active-task focus leaves a larger context margin than whole-map fit so highlighted bodies and their arrows are not pressed against the viewport edge.
- [x] #18 Switching sidebar selection while the active task set is unchanged keeps the shared active-task fit; removing an active task refits to the remaining active set.
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
1. Keep the final Backlog panel presentation and active-versus-selected styling in the web work domain.
2. Keep task-click state transitions in the pure web-work helper.
3. Derive one camera target from the union of touched representation IDs across every active task.
4. Reuse the projected-body and camera-fit logic with a task-only context margin larger than the whole-map margin.
5. Refit after every active-set transition; a sidebar-only selection switch naturally keeps the same union.
6. Cover the shared fit and context margin with focused concurrent tests, update the web-view contract, verify one-task, two-task, switch and deactivation states in the browser, then run focused checks and final reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the requested panel states in the existing web work domain: the folded Backlog mark alone is grayscale, the open heading reads Backlog.md with Tasks on the next line, and the glass uses a 35% paper mix over the existing 14px blur. Updated the web viewer contract.

Rendered Browser QA at http://localhost:52921 passed: folded state computed filter grayscale(1), open state computed filter none and label innerText Backlog.md\nTasks, both states computed a 35% paper background with blur(14px), and the console had no warnings or errors. Focused web-page and web-live checks passed (5 tests); TypeScript and git diff --check passed. The full check reached one unrelated scanner failure because Claude's uncommitted TASK-135 domain move deleted src/backlog-plugin.ts while the Git index still names it, the same clean-index limitation already recorded on TASK-135.

Final alignment refinement: the open heading mark is 29 × 36 px and its text block is 36 px high, so both share top 618 and bottom 654 in the rendered page. The label has 4 px left padding, matching the fold button's 4 px horizontal padding around the chevron. The rule is scoped to the open label; the folded and shared marks keep their existing size.

Final Browser QA at http://localhost:53354 passed in both states. Open: label text is Backlog.md\nTasks, logo and text have equal 36 px height and equal top/bottom bounds, label left padding is 4 px, the mark is coloured, the background is 35% paper with blur(14px), and no framework error overlay is present. Folded: the mark computes grayscale(1), the background remains 35% paper with blur(14px), and no framework error overlay is present. Focused web-page and web-live checks pass (5 tests), TypeScript passes, and git diff --check passes.

Final cold simplicity review: PASS. The reviewer traced createWorkIsland through parts() and rebuild() to the folded/open result, found every task-scoped CSS or markup change maps directly to one acceptance criterion, and recommended no deletion, abstraction, or decorative automated test.

Final full-context complexity review: PASS. The reviewer recommends keeping the implementation unchanged: it adds no component, state, helper, token, or dependency; reuses the Backlog mark inside src/viewers/web/work; keeps folded/open markup obvious; and scopes selectors so junior developers are unlikely to affect shared badges by mistake.

Delivery remains open because src/viewers/web/work/island.ts is still untracked as part of the completed but uncommitted TASK-135 domain move and also contains TASK-138 work. A TASK-142 commit cannot include that path without also committing other agents' work. Per the task-isolation rule, TASK-142 is not marked Done and no commit or push is made until the base domain move lands.

Applied the latest visual refinement in the existing island CSS: open-heading padding increases from 4px to 8px; only the direct folded and open-heading Backlog marks are grayscale, leaving chip badges under their existing state styling; the panel border is now an 8%-ink color mix and the downward shadow is reduced from 0 6px 24px at 12% black to 0 4px 8px at 5% black.

All seven acceptance criteria are now checked from the recorded rendered-browser evidence. The task remains In Progress only because its isolated commit still depends on the uncommitted work-domain move; acceptance progress is complete and should publish through the existing Backlog live update.

Final refinement Browser QA at http://localhost:54111 passed. Folded and open states both compute a 35% paper mix, blur(14px), 1px 8%-ink border, 0 4px 8px shadow at 5% black, and grayscale(1) on their direct Backlog marks. Open label text remains Backlog.md\nTasks; the mark and text share exact 36px top/bottom bounds; label padding computes to 8px; and no framework error overlay is present. Focused web-page/web-live tests pass (5), TypeScript passes, and git diff --check passes.

After checking all criteria, the running viewer's /world.json live payload reported TASK-142 with seven criteria and checked: true for every item, confirming acceptance progress reached the web view without restarting it.

Final refined cold simplicity review: PASS. It found the paint → rebuild → parts flow direct, every task-scoped rule necessary, the grayscale selector appropriately narrow, and no decorative test or abstraction to add.

Final refined full-context complexity review: PASS. It recommends the current approach as the simplest solid implementation: shared mark asset, island-local presentation, explicit direct-child selector that cannot affect nested chip badges, and no removable LOC or concepts. The live UI was then exercised by clicking the TASK-142 chip and showed ACCEPTANCE CRITERIA · 7 OF 7 with the completed progress ring.

Added 4px margin only after the open heading. Combined with the panel's existing 10px flex gap, this makes the heading-to-first-filter gap 14px while filter-to-filter and filter-to-chip gaps remain 10px.

Removed the chip-only active badge circle rule. The selected chip keeps its existing green pill border and text, while the map pin retains its separately owned green selection circle.

Reduced both fold-motion owners together: the chevron transform transition changes from 350ms to 300ms and the bar width/height animation changes from 350ms to 300ms. Their easing remains the existing ease curve.

Both final reviews found one stale contract sentence claiming active pins and chips both add an accent badge ring. Corrected it to say both become coloured but only pins add the ring, matching the accepted bar-versus-pin emphasis. The reviewers otherwise passed the implementation and recommended no code, abstraction, state, or test changes.

Final Browser QA for criteria 8–10: the open heading-to-first-filter gap measured 14px from the existing 10px bar gap plus label margin-right 4px; filter-to-filter and last-filter-to-strip remained 10px. With TASK-142 selected, the chip retained its 1px accent pill border while its badge computed box-shadow: none and border: none; the map pin retained its separate accent circle. The chevron computed transition-duration: 0.3s and the bar resize owner uses the matching 300ms duration. No framework error overlay appeared.

Final checks: TypeScript passed, git diff --check passed, and the five focused web-page/web-live tests passed after the visual-QA server was stopped. A prior run timed out while that extra watcher/server was still active; the clean rerun completed all five in 1.3 seconds. The targeted documentation re-review passed with no regression.

The already-running viewer on port 4747 received the final Backlog update through its live watcher and reported TASK-142 with 10 checked criteria out of 10 after the normal short watcher delay.

Separated the existing chip state classes by meaning. `.chip.active` now owns colour plus the whole-pill accent border and is ordered after hover so hover cannot erase that border. `.chip.selected` adds only font-weight 700, identifying the one active task rendered in the sidebar. The chip badge remains ringless.

Updated the web-view contract to name the final hierarchy: active pins and chips regain colour, active chips add an accent outline around the whole pill, only map pins add a badge ring, and the one selected/sidebar task also bolds its chip text.

Final active-versus-selected Browser QA used two simultaneous active chips. TASK-142 (`chip active`) computed a 1px accent pill border, accent text, font-weight 400 and no badge shadow. TASK-140 (`chip active selected`) owned the sidebar and computed the same accent pill border/text, font-weight 700 and no badge shadow. The selected map pin retained its separately scoped accent badge ring. Focused web-page/web-live tests passed 5/5, TypeScript passed, git diff --check passed, and no framework overlay appeared.

The final cold and full-context reviews passed without findings. Both approved the existing `.active`/`.selected` state split, hover ordering, domain ownership, documentation contract and absence of new abstractions or decorative tests; neither found removable LOC.

The already-running viewer on port 4747 received the final criteria update and reported TASK-142 with 12 checked criteria out of 12 after the normal short watcher delay.

Context-hunter classified the interaction change as bounded (L1). The existing state owner is render.ts, not the island: render holds the ordered active task IDs plus the selected sidebar task. Added one pure work-domain transition and wired render.ts to it. The transition preserves active highlights when switching selection, deactivates only the selected task on a repeat click, and falls back to the latest remaining active task. Added focused concurrent tests for inactive, active non-selected, selected-with-fallback, and final-clear paths; updated the web-view contract.

Browser QA at http://localhost:59208 verified the complete click sequence with TASK-142 and TASK-140: inactive click activated/selected; activating the second kept both active and selected it; one click on the first active non-selected task kept both active and moved sidebar/URL selection to it; clicking it again removed only that task and fell back to the other; clicking the final selected task cleared active work and task selection. No framework overlay appeared. Final focused checks passed 18 tests across work selection, web selection, URL, page and live files; TypeScript and git diff --check passed.

Both final reviews found the same stale render.ts comment claiming the latest active task is always selected. Corrected it to state that selection is independent and activation order supplies only the deactivation fallback. Both reviewers otherwise approved the pure work-domain transition, render integration and focused tests with no removable code or added abstraction.

The targeted re-review passed after correcting the activation-order comment. A final task-specific rerun passed all 3 work-selection tests and git diff --check. The shared full TypeScript check, which passed before the concurrent tree work changed, is currently blocked by unrelated TASK-146 partial edits changing treeRows inputs across TUI, web and tree tests; TASK-142's new work-selection module reports no error.

Added task-aware camera focus without a second task-geometry definition. focusTask reuses touchedElements, fitElements unions the projected island/slab/building bodies for those same representation IDs, and fitCamera applies its existing 24px margin capped by the existing closest zoom. Task switching and deactivation fallback both use next.selected; clearing the final task leaves the current camera. Initial task URL state uses the same focus path.

Objective verification: 19 focused tests passed across web-task-camera, work-selection, web-selection, web-url, web-page and web-live. The browser bundle built successfully and git diff --check passed. Isolated rendered Browser QA used two simultaneous active tasks: TASK-A fit Shop and Orders with limiting margins 24.01px/24.04px and centre error below 0.03px; TASK-B fit Vault and Pricing with the same rule. Switching A → B → A and deactivating A to fallback B reproduced the exact respective camera transforms. Page identity and meaningful content passed, with no framework overlay and no console warnings or errors. The shared full TypeScript check remains temporarily red only in unrelated concurrent Person → Actor and TUI action test changes; no TASK-142 file reports a type error.

Camera-focus cold simplicity review: PASS, with no removable task-scoped code, test or concept. Full-context complexity review: PASS; it approved the domain split (selection in web/work, geometry in web/iso/camera, coordination in render), the single touched-ID source for highlight and focus, and the low-mistake flow for junior developers. No required fixes or follow-ups.

The real project viewer on port 4747 loaded after the concurrent Actor rename became internally consistent. Its /world.json payload reports TASK-142 with 18 criteria and 18 checked, confirming the final progress update reached the web view.

Final shared-state rerun: bun run typecheck now passes after the concurrent Actor changes became consistent.

Corrected the first camera revision after rendered QA exposed two mismatches: it fit only the sidebar-selected task, and body-only bounds could leave a highlighted arrow outside the viewport. The final rule fits the shared highlight set: touched bodies plus outgoing highlighted routes across every active task, with a 72px context margin. Sidebar-only selection changes keep the shared transform; active-set changes refit it.

Final corrected Browser QA used TASK-142 and TASK-140 on the real Groma world. With TASK-142 alone, Render, Iso camera, and all three highlighted outgoing arrows were visible with 65–101px of rendered context. With both tasks active, Render, Iso camera, Sheet, Sheet router, and all four highlighted arrows fit together with about 72px horizontal and 96px vertical room. Switching sidebar selection from TASK-140 to TASK-142 kept the exact camera transform; deactivating TASK-142 changed the transform and refit to TASK-140. Page identity and meaningful content passed with no framework overlay or console warnings/errors.

Final checks passed: 31 focused tests across task camera, task state, isometric camera, web selection, URL, page and live behavior; bun run typecheck; browser bundle build; and git diff --check. Cold simplicity review and full-context complexity review both passed with no removable LOC, required fixes or follow-ups. Both approved fitting the same active highlight set used by painting: touched bodies plus outgoing route points, with the shared fit arithmetic and task-only context margin.

After restarting the real viewer with the final bundle, a fresh live-data check used the currently visible TASK-142 and TASK-151 chips: all three touched bodies and all four highlighted arrows were inside the map, both tasks remained active, TASK-151 owned the sidebar, and the console remained clean. The live payload reports TASK-142 at 18/18.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Refined the Backlog task panel and task interactions, then corrected task camera focus to fit the complete shared highlight set across every active task. The camera now includes touched bodies and their highlighted outgoing routes with wider context, keeps the same fit for sidebar-only selection changes, and refits when active work changes. Verified with 31 focused tests, TypeScript, bundle/diff checks, and rendered one-task/two-task switching and deactivation measurements.
<!-- SECTION:FINAL_SUMMARY:END -->
