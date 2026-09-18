---
id: TASK-419
title: List each relationship pair once in element details
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:32'
updated_date: '2026-09-18 17:54'
labels: []
dependencies: []
references:
  - flows
  - organisms-details
  - tui-navigation
  - flow
  - screen
modified_files:
  - src/viewers/relationship-text.ts
  - src/viewers/web/organisms/relationship-card.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/flow.ts
  - src/viewers/tui/panes/details.ts
  - src/viewers/tui/panes/view.ts
  - test/fixtures/relationship-pairs/groma/index.md
  - test/fixtures/relationship-pairs/groma/project.md
  - test/fixtures/relationship-pairs/groma/relationships.md
  - >-
    test/fixtures/relationship-pairs/groma/systems/backend/containers/api/components/people.md
  - >-
    test/fixtures/relationship-pairs/groma/systems/backend/containers/api/components/sessions.md
  - >-
    test/fixtures/relationship-pairs/groma/systems/backend/containers/api/container.md
  - test/fixtures/relationship-pairs/groma/systems/backend/system.md
  - >-
    test/fixtures/relationship-pairs/groma/systems/site/containers/pages/components/speakers.md
  - >-
    test/fixtures/relationship-pairs/groma/systems/site/containers/pages/components/talks.md
  - >-
    test/fixtures/relationship-pairs/groma/systems/site/containers/pages/container.md
  - test/fixtures/relationship-pairs/groma/systems/site/system.md
  - test-bun/helpers.ts
  - test-bun/relationship-text.test.ts
  - test-bun/inspect-details.test.ts
  - test-bun/routes.test.ts
  - docs/viewers/tui/index.md
  - docs/viewers/web/index.md
type: bug
ordinal: 485000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an element is inspected, every underlying relationship becomes its own entry, promoted to the inspected level. A system therefore shows the same "A to B" entry once per component pair: in callforpapers the website system lists "Conference website to Conference backend" more than five times, one per shortcode. The web details pane builds these entries in `inspectDetails` (`src/viewers/web/organisms/details.ts`), and the terminal details pane promotes relationships the same way.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Inspecting an element in the web map lists each ordered pair of visible endpoints once, with the descriptions of all relationships it summarizes.
- [x] #2 The terminal details pane lists the same combined pairs.
- [x] #3 Selecting a combined entry shows each underlying relationship with its endpoints and description.
- [x] #4 Focused tests cover grouping at system, container and component level, including both directions between the same pair.
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
1. Add one shared grouping function, relationshipPairs, to src/viewers/relationship-text.ts. It lifts each relationship to the selection's depth with promotedPeer and groups it by direction and peer, so each ordered pair of visible endpoints appears once with every relationship it summarizes. pairDescriptions lists each distinct description once. Delete outgoingActions and actionCaption.
2. Web: inspectDetails returns one entry per pair: the lifted endpoints plus the exact relationships. The details list paints one card per pair, and relationshipPairCard shows the pair's distinct descriptions. A single-relationship pair keeps opening the relationship details. Clicking a combined pair unfolds it in place to list each underlying relationship with its exact endpoints and description; each card still opens its relationship. Only one pair stays unfolded at a time, tracked as module state.
3. Terminal: selectionPairs returns the same pairs, outgoing first. A pair has one identity, its first relationship id: pickedCommandId maps the picked relationship to that id. The Enter/Space checks, the details cursor on entering details and the lit row all use it. A lit pair lists each underlying relationship with its description and exact ends. litAction/litLegs light every relationship of the lit pair.
4. Update docs/viewers/web/index.md and docs/viewers/tui/index.md.
5. Tests use the minimal Markdown fixture test/fixtures/relationship-pairs:
   - relationship-text: grouping at system, container and component level, including both directions.
   - inspect-details: Site's lifted ends, exact ends and distinct descriptions.
   - routes: one command per pair, full-pair lighting, and one pair identity after the selection moves up to a system.
6. Run bun run check in isolation with only TASK-419 hunks. Verify the web pane in a browser and the terminal pane with tui-test on a scratch copy of the fixture.

Review-fix round (external reviews of cf8e7975):
7. Fix: terminal Enter on a relationship pair row follows the first relationship's raw source when the selection is not its exact endpoint, so from a system it selects a component inside the selection itself (Site follows to Speakers instead of Backend). Enter now selects the peer the row names: the first relationship's end promoted to the selection's depth, which is the pair's peer by construction. Regression assertions in test-bun/routes.test.ts; docs/viewers/tui/index.md and the relationship row comment state the rule.
8. Skip (optional finding): storing one pair identity instead of activeActionId plus LitAction.relationshipIds would add selection-change rewriting rather than delete code.

9. Cold review: the painter's navigation comment is deleted rather than reworded; docs/viewers/tui/index.md alone states the rule.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Approach: relationshipPairs in src/viewers/relationship-text.ts promotes each relationship with promotedPeer and groups it by direction and peer; pairDescriptions keeps each distinct description once. Web inspectDetails and the terminal selectionRelationships both use it. outgoingActions and actionCaption became unused and were deleted.
Web: a single-relationship pair keeps opening the relationship details; a combined pair's center button unfolds its exact relationships in place (aria-expanded, one open pair at a time, module state in details.ts). No render.ts or selection/URL change.
Terminal: a pair is picked by its first relationship id. A lit row lists each summarized relationship (description when combined, then exact ends). litAction now carries the lit pair's relationshipIds so litLegs lights every route of the pair.
Correction: docs/viewers/web/index.md briefly held TASK-414's uncommitted edit when I first changed it; I reverted my hunk and reapplied it after TASK-414 was committed. src/viewers/tui/panes/details.ts now also holds TASK-410's uncommitted declaration hunks (visibility/type); only the import, relationship-row and whatLines hunks belong to TASK-419.
Verification: focused tests (relationship-text, inspect-details, routes) pass. bun run check passed in the shared tree (369 pass, 0 fail) and in an isolated HEAD worktree with only TASK-419 changes (363 pass, 0 fail). Web: exported a scratch copy of test/fixtures/relationship-pairs and checked it in Chrome: Site, Pages and Talks each list one row per ordered pair (Talks keeps Sessions to Talks and Talks to Sessions apart); clicking the Site to Backend pair unfolds Speakers to People, Talks to People and Talks to Sessions with descriptions, and a nested center action opens ?relationship=speakers/people; no console errors. Terminal: tui-test on the same copy shows the combined rows for Api and Backend, the lit combined row lists the three exact relationships and the Pages to Api route lights; Sessions (component) lists both directions separately.

Cold review applied:
- The terminal pair now has one identity (pickedCommandId): the Enter/Space comparisons, the enterDetails cursor and the whatLines lit check all use it. Added a routes test for the sequence: light Talks to Sessions, move to Site, enter details. The cursor is on the lit Site to Backend pair, Space clears it and Enter follows.
- Renamed selectionRelationships to selectionPairs.
- RelationshipPair and relationshipPairs are concrete AnnotatedRelationship types; the RelationshipRow alias is gone.
- Dropped the stored descriptions field; relationshipPairCard calls pairDescriptions.
- Clarified the openPair comment.
- Trimmed repeated tests to Site-only checks in inspect-details and routes.
- Left actionTitle in view.ts as it was: it predates the task, and this task only simplified one line in it.
- Corrected in the review-fix round below: Enter on a lifted row followed the first relationship's raw source rather than the lifted peer, so from a system it selected a component inside the selection itself.
Verification after review:
- bun run check in an isolated HEAD worktree with only TASK-419 hunks (TASK-410's two declaration hunks in panes/details.ts excluded): 368 pass, 0 fail.
- tui-test on the fixture copy: after lighting Talks to Sessions and selecting Site, Enter from the map puts the cursor on the lit Site to Backend row (its background is the accent colour). Space clears the highlight, Space relights it, and Enter follows.

Review-fix round (external reviews of cf8e7975).
Fixed: Enter on a relationship pair row followed the first relationship's exact other end only when the selection was that relationship's exact endpoint and otherwise took its source, so from Site it selected Speakers (inside Site) and from Pages the same. followRelationship in src/viewers/tui/navigation.ts now selects promotedPeer of the pair's first relationship, which is the peer the row names, at every depth, matching the web rule. docs/viewers/tui/index.md states it in one sentence; the painter's navigation comment was removed.
Tests: test-bun/routes.test.ts asserts that Enter on the lit Site pair selects backend, and the lit-pair identity test now asserts backend instead of "not site"; both fail with cf8e7975's navigation.ts.
Skipped (optional): one stored pair identity instead of activeActionId plus LitAction.relationshipIds would rewrite activeActionId on every selection change, adding code rather than deleting it.
Verification: tui-test on a scratch copy of test/fixtures/relationship-pairs: Api with its lit row follows to Pages, Site with its lit combined row follows to Backend. Cold review confirmed every pair in the fixture and a deeper-peer world select the row's peer. Isolated worktree bun run check exit 0 (biome 1 warning and 2 infos in untouched files, tsc clean, node 16 pass, bun 520 pass 34 skip 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Element details now list each ordered pair of visible endpoints once instead of one entry per underlying relationship.
- Shared code: relationshipPairs in src/viewers/relationship-text.ts groups relationships lifted to the inspected level by direction and peer; both viewers use it.
- Web: a pair card shows its distinct descriptions. A single relationship still opens its details; a combined pair unfolds in place to show each exact relationship with its endpoints and description.
- Terminal: a pair row shows the same combined descriptions. Highlighting it lists each exact relationship beneath it and lights all of their routes. The pair keeps one identity (its first relationship) for the cursor, Space and Enter.
- Docs: web and terminal viewer docs updated.
- Verification:
  - Focused tests on a new relationship-pairs fixture cover grouping at system, container and component level in both directions, the web pair data, terminal lighting and pair identity.
  - bun run check passed in an isolated worktree with only this task's changes (368 pass).
  - The web pane was checked in Chrome on an exported fixture copy, and the terminal pane with tui-test.

Review-fix round: terminal Enter on a relationship pair row now selects the peer the row names (the first relationship's end promoted to the selection's depth) instead of a component inside the selection; routes tests fail without the fix, tui-test confirms Api follows to Pages and Site to Backend, and an isolated bun run check exits 0.
<!-- SECTION:FINAL_SUMMARY:END -->
