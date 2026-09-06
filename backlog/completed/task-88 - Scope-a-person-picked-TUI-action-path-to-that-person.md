---
id: TASK-88
title: Scope a person-picked TUI action path to that person
status: Done
assignee:
  - '@claude'
created_date: '2026-08-17 22:19'
updated_date: '2026-08-17 22:24'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two people can share a launcher, so its commands appear under both. The walk actionLegs builds includes every person's approach edge to the launcher, so picking a command from Human architect also lights Coding agent's approach and card on the TUI map. A pick made from a person's details must light only that person's way into the walk; picks without a person context (the flows list, travelled-by rows) keep lighting every sharer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Picking a command from a person's details lights only that person's approach; other people sharing the launcher stay dim with their approach routes unlit
- [x] #2 Stepping with s and the footer captions trace only the picked person's walk
- [x] #3 Picking from the flows list or a travelled-by row keeps lighting every sharer; x clears the person scope with the path
- [x] #4 The scoped walk and the pick contexts are covered by fixture tests and bun test passes
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
1. action-path.ts: actionLegs gains an optional personId; when set, only that person's approach edge joins the walk (actionPath and all other callers unchanged).
2. navigation.ts: activeActionPersonId? on ViewerState; a What-tab details pick records the picking person (the selection), a flows-list or travelled-by pick leaves it unset, x clears it with the path.
3. paint.ts and terminal-viewer.ts thread activeActionPersonId into actionLegs so map lighting, dimming, stepping, and captions all follow the scoped walk.
4. Fixture tests: actionLegs with personId drops the other person's approach; the pick contexts set and clear the person scope.
5. bunx tsc, bun test, agent-tty: pick Runs a scan from Human architect and confirm Coding agent stays dim with its approach unlit and the caption walks 1/2.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
actionLegs gained an optional personId that keeps only that person's approach edge (all other callers unchanged, so the web viewer keeps its current behavior). ViewerState carries activeActionPersonId: set by a What-tab details pick (the selection is the person), left unset by flows-list and travelled-by picks, cleared by x; step-action and paint derive the walk with it, so map lighting, dimming, stepping, and captions all follow. agent-tty evidence at 120x36: picking Runs a scan from Human architect now captions 'step 1/3 · Human architect → Cli · Starts the viewers' (previously the first leg was Coding agent's approach) and the screenshot shows only Human architect's approach lit with Coding agent dim; after x, the same command picked from the flows list lights both approaches (Runs and Starts labels both lit). Fixture tests: scoped actionLegs drops the other approach; the details pick records the person, the flows pick does not, stepping wraps at two legs, x clears the scope. bunx tsc clean, bun test 157 pass.

Cold simplicity review: no accept-worthy findings; applied the docs-reflow nit and kept the three inline pick objects (the reviewer called the helper optional and the inline form defensible). Post-review: bunx tsc clean, bun test 157 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A command picked from a person's TUI details now walks in from that person alone: actionLegs takes an optional personId that keeps only that person's approach edge, and ViewerState.activeActionPersonId records the picker (set by What-tab picks, unset by flows-list and travelled-by picks, cleared by x), so lighting, dimming, stepping, and captions all follow the scoped walk. Verified with fixture tests (scoped legs, all three pick contexts, two-leg wrap, clear) and agent-tty screenshots: Human architect's pick lights only their approach with Coding agent dim, while the flows-list pick lights both. bunx tsc clean, bun test 157 pass.
<!-- SECTION:FINAL_SUMMARY:END -->
