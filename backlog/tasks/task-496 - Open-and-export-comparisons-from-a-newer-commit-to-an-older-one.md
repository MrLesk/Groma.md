---
id: TASK-496
title: Open and export comparisons from a newer commit to an older one
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 18:13'
updated_date: '2026-09-23 19:41'
labels: []
dependencies: []
references:
  - scene
  - history-revisions
  - web-server
  - revision-control
modified_files:
  - src/history/comparison.ts
  - test-bun/revision-comparison.test.ts
  - src/history/revisions.ts
  - src/viewers/web/map-session.ts
  - src/viewers/web/export.ts
  - src/viewers/web/revision/control.ts
  - test-bun/web-revisions.test.ts
  - test-bun/web-export.test.ts
  - docs/viewers/web/index.md
priority: high
type: bug
ordinal: 577000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Comparing c9cf7687 (newer) against 9176a68c (older) fails in placement, before any routing: TypeError "undefined is not an object (evaluating 'rects.get(id).gy')" in centre() inside placeRow (src/sheet/place.ts), called from placeWorld through measuredSheetScene. The same pair in the forward direction (9176a68c against c9cf7687) works. Two reproductions: the live viewer answers /world.json?from=<c9cf7687>&revision=<9176a68c> with 422 "Cannot compare these revisions" (in-process map session, scanning off); and groma export <dir> --from 9176a68c --revision c9cf7687 crashes, because the export also builds the reversed comparison (comparisonView(after, before) in src/viewers/web/export.ts) so closing a comparison can open either commit. The crash predates TASK-482 and TASK-493: an export of the same pair failed on 2026-09-22 with the previous router and growth placement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When an element's id changes kind between the two commits (for example a component that became a container), the comparison keeps both versions as separate elements and places every element; an automated test reproduces the failing placement with a minimal fixture world and passes after the fix
- [x] #2 A comparison always runs from the older commit to the newer one: choosing a start offers only commits older than the destination, choosing a destination only commits newer than the start, and the working tree is never a start
- [x] #3 The live viewer answers a request naming the newer commit as the start (from=c9cf7687, revision=9176a68c) with the 9176a68c to c9cf7687 comparison and its map, and the header then shows the older commit first
- [x] #4 groma export <dir> --from 9176a68c --revision c9cf7687 completes, gives the same export with the two commits swapped, and the export holds one comparison, from the older commit to the newer
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
Final approach (owner decision: fix the merge and make every comparison run from the older commit to the newer one):
1. src/history/comparison.ts withChangedKindsApart: before merging, an id that names a different kind of element in each revision is split: the destination's element keeps the id, and the start's becomes removed:<id> (id and representationId), as removed relationships already do, together with the start revision's references to it (children's parents, relationship endpoints). The merge itself is unchanged, so the start's children now hang under their own parent and get placed.
2. Older means lower in the newest-first history list, as the time machine shows it, with the working tree newest. The live server (map-session.ts comparedPair) orders a requested pair by the positions in the history list it already reads, so any request and the link it answers run older to newer. The export, which has no history list, orders its two commits by ancestry (olderFirst in src/history/revisions.ts, git merge-base): commits on diverging branches keep their order, and commits with no shared history fail.
3. src/viewers/web/export.ts: one comparison view instead of both directions, and the time machine list newest first, as live.
4. src/viewers/web/revision/control.ts: the commit list disables every row on the wrong side of the other endpoint (the list runs newest first under the working tree): a start must sit below its destination, a destination above its start, so the working tree is never a start.
5. Tests: revision-comparison.test.ts gains the kind-change case (fails before the fix with the placement crash); web-revisions.test.ts asks a live session for the reversed order; web-export.test.ts exports with the commits swapped and expects one comparison, older first. Docs: time machine, comparison and export paragraphs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-23 root cause (investigation only, nothing changed): the id export is a component in 9176a68c (parent web-viewer, system groma) and a container in c9cf7687 (parent groma-md), where it holds the component revision-control. compareArchitecture keeps one element per id, taken from the destination side. From c9cf7687 to 9176a68c, export becomes the older component, so revision-control (removed, parent export) has a component parent, is never placed, and placeRow in src/sheet/place.ts crashes on centre(revision-control) for the relationship developer -> revision-control (removed:relationship:8). The mirror history (a container that later becomes a component while its old children are removed) fails the same way from older to newer, so putting the older commit first only avoids this pair. Owner asked whether comparisons could always put the older commit first; decision pending: fix the merge (keep both kinds of an id as separate elements, as removed relationships already get removed: ids) and optionally make comparisons always older to newer.

2026-09-23 owner decision (option 2): fix the merge and make every comparison run from the older commit to the newer one. Criteria rewritten to match.

2026-09-23 implemented and verified:
- AC 1: the new revision-comparison.test.ts case places revision-control and both versions of export in both directions; with withChangedKindsApart switched off it fails (the reversed direction throws in placeRow). On the real pair, the reversed comparison world now places every element.
- AC 2: live viewer from an isolated checkout of the change (groma web on port 4811; port 4799 was taken by a system WebDriver on localhost): on the 814-row history with the comparison 9176a68c to c9cf7687 open, choosing a start disabled the working tree, the 26 newer commits and the destination (27 rows) and enabled all 787 older rows; choosing a destination disabled the start and the 490 older rows and enabled the 323 newer ones including the working tree; no row broke the rule.
- AC 3: the same live viewer opened ?from=c9cf7687&revision=9176a68c as 9176a68c to c9cf7687, the start field showing 9176a68c, and rewrote the URL older first; an in-process session answers both orders with the same comparison (222 buildings, 172 routes).
- AC 4: groma export --from 9176a68c --revision c9cf7687 and the swapped command both complete; their payloads are identical apart from run timings and generation counters, with the list c9cf7687, 9176a68c and three views: 9176a68c, c9cf7687 and 9176a68c to c9cf7687.
- The two ordering tests fail with olderFirst reduced to the given order. bun run check exit 0 (16 Node pass; 706 Bun pass, 43 skip, 0 fail).

2026-09-23 end-of-task complexity review (general-purpose agent with a brief and the transcript path). Blocking finding fixed: starting a comparison scrolled the list to the first disabled row, which after the ordering rule is the working tree at the top instead of the destination (reproduced by the reviewer on a scratch clone). revealDestination now finds the destination row by its id; live check on the isolated checkout: viewing 9176a68c and choosing compare 2 revisions opens the 814-row list with the destination (row 323) as the first visible row, its parent enabled below it, and every row above disabled. Also moved olderFirst below readGitRevision's doc comment, which it had split. bun run check exit 0 (706 Bun pass, 16 Node pass). Open recommendations for the owner: define older once (list position on the live server, ancestry only in the export), dropping a git call per comparison request and the unapproved catch that keeps unrelated commits in the given order; one naming for the two snapshots in compareArchitecture; the export's list newest first from exportRevisions.

2026-09-23 owner: "apply" the one-definition cleanup. The live server now orders a pair by position in its newest-first history list, the same rule the header uses, without a git call; olderFirst serves only the export, takes two commits, and no longer catches git failures, so commits with no shared history fail the export instead of keeping their order. The live ordering assertion in web-revisions.test.ts fails with the list rule switched off. bun run check exit 0 (16 Node pass; 706 Bun pass, 43 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Comparisons between two commits where an id changed kind no longer crash: the start revision's element becomes a separate removed element with its own children, so c9cf7687 against 9176a68c now opens with every element placed. Every comparison also runs from the older commit to the newer one, as the owner chose: the header offers only older commits as a start and newer ones as a destination (the working tree only ever as a destination), the live server turns a newer-first request into the older-first comparison, and an export takes the two commits in either order and bundles one comparison instead of both directions. Older means lower in the newest-first history list; the export, which has no list, uses git ancestry. Verified with a new comparison test that fails without the fix, live and export ordering tests that fail without the rule, a live viewer on the 814-commit history, both export orders producing identical payloads, the end-of-task review (its one regression, the start list opening at the top, fixed and verified), and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
