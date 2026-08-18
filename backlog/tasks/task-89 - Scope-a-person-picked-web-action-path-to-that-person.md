---
id: TASK-89
title: Scope a person-picked web action path to that person
status: Done
assignee:
  - '@claude'
created_date: '2026-08-17 22:27'
updated_date: '2026-08-18 06:03'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mirror of TASK-88 on the web viewer: two people can share a launcher, so picking a command from one person's details still lights every sharer's approach on the city. A pick made from a person's details must light only that person's way into the walk; picks from the sidebar flows list or a Travelled-by row keep lighting every sharer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Picking a command from a person's web details lights only that person's approach; other people sharing the launcher stay dim with their approach routes unlit
- [x] #2 Flow playback, stepping, and captions follow the scoped walk
- [x] #3 Picking from the sidebar flows list or a travelled-by row keeps lighting every sharer; x clears the person scope with the path
- [x] #4 The active-action state transitions are covered by fixture tests and bun test passes
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
1. web organisms/details.ts: nextActiveActionId becomes nextActiveAction over an ActiveAction {id?, personId?} pair (pick carries an optional personId, select keeps, clear wipes); the two pick row kinds tell the callback whether the row is the person's own command (relationship rows) or a walk reference (travelled-by rows).
2. render.ts: activeAction pair replaces activeActionId; a walkLegs() helper derives the scoped legs for pathIds, outlines, playback, and captions; syncFlow keys on id plus personId so re-picking the same command from another context rebuilds the overlay; details picks pass the selected person, sidebar and travelled-by picks do not; x clears the pair.
3. Update the active-action fixture test to the pair transitions.
4. Docs: the web viewer page notes the person-scoped pick.
5. bunx tsc, bun test, browser check: person pick lights one approach, sidebar pick lights both, captions follow, x clears.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
nextActiveActionId became nextActiveAction over an ActiveAction {id?, personId?} pair in web details.ts; a pick carries an optional personId, select keeps it, clear wipes it. paintDetails' onPickAction now says whether the row is the person's own command (relationship rows true, travelled-by rows false); render.ts scopes the pick to the selected person only for own-command rows, keeps sidebar/travelled-by picks person-less, derives all lighting/outlines/playback/captions from one walkLegs() (actionLegs with the person scope), and keys syncFlow on id plus personId so re-picking the same command in another context rebuilds the overlay. Browser evidence on 4791: Human architect's 'Runs a scan' pick steps 'step 1/3 · Human architect → Cli' (no Coding agent leg); the sidebar pick of the same command steps 'step 1/4 · Coding agent → Cli' then 'step 2/4 · Human architect → Cli'; switching contexts without x rebuilds 3-leg to 4-leg; x clears. Fixture test updated to the pair transitions including scope drop on a person-less re-pick. bunx tsc clean, bun test 157 pass.

Cold simplicity review: applied the accept-worthy finding (actionPath gained the same optional personId, so the duplicated 'new Set(walkLegs().map(...))' collapses back into the shared litRoutes()/actionPath name) and the cheap nits (paintSelection computes legs once and passes them to paintFlow, walkLegs declares WorldRelationship[], the flow key drops its unreachable '' branch, docs rewrapped). The boolean-at-callsite and identity-select nits were left as the reviewer allowed; the cross-viewer state-shape unification is out of scope for this fix. Post-review browser re-check on 4791: person pick still steps 1/3 from Human architect, sidebar pick 1/4 from Coding agent, x clears. bunx tsc clean, bun test 157 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web viewer now scopes a person-picked walk the way the TUI does: the active action carries the picking person (ActiveAction {id, personId} via nextActiveAction), details rows say whether they are the person's own command or a walk reference, and every lit route, dimmed box, playback leg, and caption derives from the scoped walk through walkLegs()/litRoutes(); sidebar and Travelled-by picks stay person-less and x clears the scope. Verified with the updated fixture test and browser checks: Human architect's 'Runs a scan' walks 3 legs from Human architect, the same command from the sidebar walks 4 legs including Coding agent, switching contexts rebuilds the overlay, and x clears. bunx tsc clean, bun test 157 pass.
<!-- SECTION:FINAL_SUMMARY:END -->
