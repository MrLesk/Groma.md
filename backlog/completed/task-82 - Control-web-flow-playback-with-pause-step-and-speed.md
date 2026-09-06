---
id: TASK-82
title: 'Control web flow playback with pause, step, and speed'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-17 20:50'
updated_date: '2026-08-17 21:14'
labels: []
dependencies: []
priority: high
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An active person-command flow animates continuously but cannot be paused, stepped, or slowed, and nothing names the leg the payload is on. While a flow is active, show playback controls in the web header: pause/resume, trace one step, and 0.5x/1x/2x speed, plus a caption naming the current leg. Approved example: the reference demo's flow header controls and step captions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 While a flow is active the header names it and offers pause/resume, trace-one-step, and 0.5x/1x/2x speed controls; none of these appear when no flow is active
- [x] #2 Pause freezes the travelling payload in place, resume continues it, and a speed change takes effect immediately
- [x] #3 Trace one step advances the payload one relationship leg at a time and shows a caption naming that leg's source, target, and relationship label
- [x] #4 Clearing the flow removes the controls and the caption
- [x] #5 Playback state transitions are covered by fixture tests and bun test passes
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
1. src/viewers/action-path.ts: add actionLegs(actionId, world) returning the walk's relationships in travel order (person approach edges, then the picked action and downstream in BFS order); actionPath becomes a Set over it, same membership.
2. New pure src/viewers/web/flow-playback.ts: Playback {paused, rate, step} with initialPlayback and nextPlayback reducer for toggle-pause (exits stepping), rate, step (advances and wraps over legCount), clear.
3. page.ts: header gains a hidden flow area naming the active flow with pause/resume, step, and 0.5x/1x/2x buttons in the existing .controls style.
4. render.ts: replace the flowStart clock with dt accumulation honoring paused and rate; flow dots carry their route id and only the current leg's dots show while stepping; wire the header buttons; footer caption shows 'step k/n · source → target · label' while stepping; flow change or clear resets playback and hides the controls.
5. Tests: actionLegs travel order in action-path.test.ts; nextPlayback transitions in a new flow-playback test. bunx tsc, bun test, browser check of pause/resume, step captions, speed change, clear.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
actionLegs added to action-path.ts (person approaches, then BFS from the picked action; actionPath is now a Set over it, membership unchanged, covered by an order test). Pure flow-playback.ts reducer {paused, rate, step} drives render.ts: stepFlow accumulates frame deltas honoring paused and rate; dots carry routeId and only the traced leg's dots show; header #flow area (name, Pause/Play, Step, 0.5x/1x/2x) hidden without an active flow; footer captions 'step k/n · source → target · label'. Browser evidence on 4791: paused frames byte-identical 800ms apart (cmp), playing frames differ; step captions 'step 1/4 · Coding agent → Cli · Runs Groma while implementing' then 2/4, wrapping verified (12 clicks returns to same step); 2x activates immediately; x hides controls and restores the hint. bunx tsc clean; bun test 150 pass (one earlier run had a non-reproducing environment flake).

Cold simplicity review: applied both accept-worthy findings (deleted the never-dispatched 'clear' reducer variant and its test; merged paintFlow and applyPlayback into one paintFlow(legs) that derives legs once per event, with playbackEvent computing legCount itself) and all three nits (dropped the tautological set-equality test assertion, hoisted the duplicated title, flowHost uses the ! assertion). Post-review: bunx tsc clean, bun test 149 pass, browser re-check green (controls appear, Pause label flips, step caption 'step 1/4 · Coding agent → Cli · Runs Groma while implementing', 0.5x activates, x hides controls).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web header now carries flow playback while a person command is active: Pause/Play freezes and resumes the travelling payload (frame-delta clock, verified with byte-identical paused screenshots 800ms apart vs differing playing frames), 0.5x/1x/2x change speed immediately, and Step traces the walk one leg at a time with a 'step k/n · source → target · label' footer caption over the new ordered actionLegs walk; clearing hides everything. State lives in the pure flow-playback reducer covered by fixture tests; actionLegs order has its own test. bunx tsc clean, bun test 149 pass, browser-verified end to end.
<!-- SECTION:FINAL_SUMMARY:END -->
