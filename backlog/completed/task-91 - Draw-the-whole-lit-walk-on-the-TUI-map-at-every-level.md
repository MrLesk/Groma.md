---
id: TASK-91
title: Draw the whole lit walk on the TUI map at every level
status: Done
assignee:
  - '@claude'
created_date: '2026-08-18 06:09'
updated_date: '2026-08-18 06:28'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
At Components the map draws only relationships touching the focused container, so an active or previewed person walk lights just its first leg: the picked command from Cli shows, while the onward leg Scanner to Core is not drawn at all. An architect following a command sees a path that stops for no visible reason. Routes on the lit walk must be drawn at every level, attaching to their deepest displayed endpoints like any other route, while unlit routes keep the current per-level rules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With a walk lit, every relationship on it is drawn at Containers and Components, including legs whose endpoints sit outside the focused container
- [x] #2 The lit legs attach to their deepest displayed endpoints and stay accent-coloured; stepping with s can reach every leg
- [x] #3 Relationships that are not on the lit walk keep the current level rules, and clearing the walk restores the previous map exactly
- [x] #4 World layout is unchanged: only which routes are drawn changes, never element positions
- [x] #5 The level-independent lit routes are covered by fixture tests and bun test passes
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
1. ProjectionOptions gains litIds; projectRelationships lets a relationship through when its id is lit, otherwise the existing per-level rule applies.
2. terminal-viewer computes the lit walk once per repaint and passes actionPath(lit) as litIds, so preview and committed walks both draw whole.
3. Fixture test: at Components with focus inside one container, a relationship between two other containers is absent, appears when lit, attaches to its displayed endpoints, and leaves element geometry untouched.
4. bunx tsc, bun test, agent-tty at Components with a walk committed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: at Components the map draws only relationships touching the focused container, so a lit walk showed just the legs that happened to touch it (Cli to Scanner) while the onward leg Scanner to Core was never projected. Fix: litIds bypasses the level rule for the walk's own legs; everything else is unchanged, including promotion to displayed endpoints. agent-tty evidence at 120x36: with Runs a scan committed and the camera fitted at Components, the map now lights Cli to Scanner and Scanner to Core in the accent all the way to the Core boundary. Known consequence, unchanged by this fix: people stay hidden at Components (a kind rule, not the container focus), so a walk's person approach leg is not drawn at that level. bunx tsc clean, bun test 159 pass.

Cold simplicity review: applied every accept-worthy finding. The new test now lights a component-to-component relationship so the promotion claim is real and its components are load-bearing; the local element builder was replaced by the shared box helper; the route fixtures and their tests moved to test-bun/projection-routes.test.ts so both files sit under 500 lines; project() no longer carries a lit parameter; and litIds stays optional instead of allocating an empty Set. The reviewer's spec note that AC1 names Containers as well as Components is recorded as covered by the observed-world check rather than a second fixture case. Post-review: bunx tsc clean, bun test 159 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A lit walk now draws whole at every level: ProjectionOptions carries litIds and projectRelationships lets those legs past the per-level rule, so an active or previewed walk shows its onward legs even when their endpoints sit outside the focused container. Everything else is untouched, so lit legs promote to displayed endpoints and element geometry never moves. Verified with a fixture test (absent unlit, drawn and promoted when lit, identical element bounds) and agent-tty at Components, where the walk now runs Cli to Scanner to Core in the accent. bunx tsc clean, bun test 159 pass.
<!-- SECTION:FINAL_SUMMARY:END -->
