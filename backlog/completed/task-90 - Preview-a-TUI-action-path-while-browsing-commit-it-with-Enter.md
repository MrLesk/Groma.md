---
id: TASK-90
title: 'Preview a TUI action path while browsing, commit it with Enter'
status: Done
assignee:
  - '@codex'
created_date: '2026-08-18 06:07'
updated_date: '2026-08-23 17:49'
labels: []
dependencies: []
modified_files:
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/paint.ts
  - src/viewers/tui/terminal-viewer.ts
  - test-bun/helpers.ts
  - test-bun/navigation.test.ts
  - test/fixtures/viewer-view/groma/missing/README.md
  - test/fixtures/viewer-view/groma/observed/README.md
  - test/fixtures/viewer-view/groma/observed/people/shop-architect.md
  - test/fixtures/viewer-view/groma/observed/people/shop-operator.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/api/components/orders.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/api/components/pricing.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/api/container.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/gateway/components/router.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/gateway/container.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/order-viewer/components/order-page.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/order-viewer/container.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/stock-viewer/components/stock-page.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/stock-viewer/container.md
  - test/fixtures/viewer-view/groma/observed/systems/shop/system.md
  - test/fixtures/viewer-view/groma/observed/systems/vault/system.md
  - test/fixtures/viewer-view/groma/plans/README.md
priority: high
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the TUI a person's commands are browsed with Up and Down in the details pane and picked with Enter, but nothing shows until the pick, so an architect cannot see where a command goes before committing to it. Light the browsed command's walk on the map as a preview: it follows the details cursor, and Enter commits it as the path that survives leaving the pane. Leaving details without Enter drops the preview and restores whatever was committed before.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Moving the details cursor over a person's commands lights that command's walk on the map immediately, scoped to that person
- [x] #2 Enter commits the browsed command, so the walk stays lit after leaving the details pane
- [x] #3 Leaving details without Enter (Esc, Left, or selecting elsewhere) drops the preview and restores the committed walk, or no walk when none was committed
- [x] #4 The details pane still marks the committed command distinctly from the browsed one, and x clears the committed walk
- [x] #5 The previewed-versus-committed walk derivation is covered by fixture tests and bun test passes
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
1. navigation.ts: export litAction(world, state) returning the walk the map lights: while details focus rests on one of that tab's pickable commands, the cursor's command scoped to the selected person on the What tab; otherwise the committed activeActionId/activeActionPersonId pair.
2. navigation.ts: moving the details cursor resets actionStep so a preview starts unstepped.
3. terminal-viewer.ts computes litAction once per repaint and passes it to paintWorld; paint.ts derives legs, pathIds, dimming, the traced leg, and the footer caption from it, while details and the flows rows keep marking the committed command.
4. Fixture tests: browsing previews the cursor's scoped walk, leaving details drops it back to the committed one (or none), Enter commits, How-tab previews carry no person scope.
5. bunx tsc, bun test, agent-tty: browse Human architect's commands and watch the map light per row, Esc drops it, Enter keeps it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
litAction(world, state) is the single derivation of what the map lights: while details focus rests on one of the tab's pickable commands that row is previewed (scoped to the selected person on the What tab), otherwise the committed activeActionId/activeActionPersonId pair shows. Moving the details cursor resets actionStep so each preview starts unstepped; step-action steps the lit walk, so s works on a preview too. terminal-viewer computes litAction per repaint and paint derives legs, pathIds, dimming, the traced leg, and the caption from it, while the details rows and hierarchy flow rows keep marking the committed pick. agent-tty evidence at 120x36: entering Human architect's details and pressing Down lit the first command's route (green 'Starts' and arrow) with nothing committed; the footer stayed '↑↓ action enter pick x clear esc map'. Fixture test covers preview on browse, scope to the person, drop on dismiss with nothing committed, Enter committing, preview over an existing commitment restoring it on dismiss, and a How-tab preview carrying no person scope. bunx tsc clean, bun test 158 pass.

Current verification: bun test test-bun/navigation.test.ts passes 9 tests with 0 failures; implementation commit 9f75457 is on main and origin/main. Final architecture review found no blocking issue: separate cursor and committed state plus one litAction derivation is the simplest defensive production design. Non-blocking cleanup: group action-path navigation tests in their own domain test file and correct one stale comment. test-bun/navigation.test.ts currently also contains another task's actor-vocabulary work, so that cleanup was not mixed into this closeout.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added immediate action-walk preview while browsing, explicit Enter commit, cancellation restoration, and clear behavior through one derived lit action. Verified by the focused 9-test navigation suite and existing 120x36 agent-tty interaction evidence; final architecture review found no blocking issue.
<!-- SECTION:FINAL_SUMMARY:END -->
