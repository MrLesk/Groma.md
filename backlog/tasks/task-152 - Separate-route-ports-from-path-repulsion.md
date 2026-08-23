---
id: TASK-152
title: Separate route ports from path repulsion
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 18:00'
updated_date: '2026-08-23 19:03'
labels: []
dependencies: []
references:
  - sheet
  - sheet-router
modified_files:
  - src/sheet/port-layout.ts
  - src/sheet/route.ts
  - test-bun/sheet-route.test.ts
  - src/sheet/scene.ts
  - groma/observed/systems/groma/containers/core/components/sheet-router.md
  - test-bun/sheet-port-layout.test.ts
ordinal: 163000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect opens the web map, one relationship on a building side must meet that side at its visual centre; relationships sharing a side must spread symmetrically. The router must keep those ports and their straight approaches fixed while route repulsion shapes only the path between them. This also removes the short reversals beside Terminal host shown in the approved Groma examples.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One relationship on a curved building side meets the exact visual centre of that side; multiple relationships on the same side use distinct ports balanced around the centre
- [x] #2 A fixed source or target approach never reverses, retraces a lane, or re-enters itself before joining the route body, including the approved Terminal host examples
- [x] #3 Port placement is deterministic and independent of route-repulsion cost, while existing side-facing, building-clearance, departure-corridor, and clean-arrival behavior remains intact
- [x] #4 Minimum concurrent fixture tests cover centred single ports, balanced shared-side ports, and routes with no repeated lane; relevant checks and browser QA pass
- [x] #5 A single relationship prefers the exact middle of its target side when a complete valid route can use it; blocked centred arrivals retain the nearest valid port
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
1. Keep side geometry, port enumeration, concrete port pairs, and centre/symmetric allocation in the sheet-domain port-layout module.
2. Run a preliminary route pass only to select obstacle- and route-aware sides and baseline ports. Classify each endpoint with an explicit baseline, preferred-centre, or exact centre-balanced policy.
3. Convert every relationship to an ordered concrete source/target pair before the final pass. Preserve an already straight connection between aligned elements; otherwise prefer a single target-side centre and fall back centre-out only when the complete route is blocked.
4. Route each concrete pair with A*. Keep fixed approaches outside route repulsion and prevent immediate reversal, side entry, retracing, and return through the one-cell departure area.
5. Cover the port-layout policy and route-body invariants with small concurrent fixtures, then verify the live Groma world, focused tests, the isolated full check, and the required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope includes the approved actor, Create/Edit, Screen, Terminal host, and Git examples. The separate west-arrow source problem was confirmed as authored architecture Markdown: Groma no longer owns a system-level Git relationship; Markdown emitter now owns the write to Git. Those two Markdown source edits remain outside the TASK-152 modified-file list and will be committed separately.

Implementation: `port-layout.ts` owns side geometry and deterministic port policy. `route.ts` first discovers viable sides, then receives concrete source and target pairs and uses cost only to shape each route body. One round-side route is exact-centred and several are symmetric. A normal target prefers its centre, tries every source port before relaxing that target, then tries alternatives nearest-first if blocked. A direct connection between aligned elements stays straight. Fixed departure prefixes are blocked from later side entry; every start stores the fixed half-cell guard point so reverse and departure-band checks remain correct even when a crowded source uses a full-cell prefix.

Correction history: the first port allocator returned matched candidate sets but allowed the final A* pass to choose within them, so route cost could still affect the port. This was replaced by a concrete `PortPair` for every relationship. Quality review then reproduced side entry/retrace, a non-nearest blocked fallback, and repulsion-influenced symmetric assignment; each was removed and covered. The first fully concrete version made live relationship:13 unroutable, so ordered concrete side-pair fallbacks were added without returning port choice to A*. The isolated full suite then caught a bent direct connection between aligned children; the baseline is now retained only for that already straight geometry. The final architecture review found target alternatives could be tried before alternate sources; a target-first loop replaced four phases plus duplicate tracking, removed 10 lines, and gained a focused regression test. Specification review then found live relationship:39 re-entered the visible departure band because its full-cell prefix moved the guard origin; the guard now remains on the fixed half-cell approach, with a generic four-building regression fixture.

Verification: 32 focused routing, port-layout, and growth tests pass. A detached worktree containing only TASK-152 changes passes TypeScript, 93 Node tests, and 151 viewer tests. `src/sheet/route.ts` is 500 lines; every other changed source/test file is below the project limit. Current live composition succeeds for all 55 relationships, and a scripted check using the task departure-band rule reports no re-entries. Programmatic live geometry confirms Coding agent leaves west for one cell before turning, relationship:13 routes cleanly, Terminal host departures do not make local U-turns, and both component-owned Git routes arrive on the target middle line. Browser QA captured the approved actor, Terminal host, and Git examples before the final guard corrections. The browser client later entered a URL-policy error state that explicitly forbade reopening or another browser surface; the final corrections are instead covered by the focused, all-live-route, and detached full checks.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Separated deterministic source/target port layout from route-body repulsion. Round actors now centre or balance ports, normal targets keep the centre whenever any valid source can reach it, aligned direct routes stay straight, and fixed approach guards prevent reversal or re-entry. Verified with 32 focused tests, a detached TypeScript plus 93 Node and 151 viewer-test check, all 55 live routes with zero departure-band re-entries, programmatic Groma geometry, earlier browser QA, and passing simplicity, specification, quality, and full-context architecture reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
