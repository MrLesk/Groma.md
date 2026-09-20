---
id: TASK-378
title: Allocate routing space from connection demand before placing the map
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 17:01'
updated_date: '2026-09-13 17:20'
labels: []
dependencies: []
references:
  - sheet-composition
  - sheet-routing
modified_files:
  - src/sheet/route-space.ts
  - src/sheet/route-geometry.ts
  - src/sheet/measure.ts
  - src/sheet/route-grid.ts
  - src/sheet/grid.ts
  - src/sheet/forces.ts
  - src/sheet/place.ts
  - src/sheet/compose.ts
  - src/sheet/route-search.ts
  - test-bun/sheet-route-space.test.ts
  - docs/viewers/web/index.md
  - test-bun/sheet-compose.test.ts
type: enhancement
ordinal: 424000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A valid saved architecture could fail to open because placement and routing independently assumed different amounts of free space. TASK-376 fixed one overlapping-exit instance. Users need the drawing engine to allocate connection space itself, rather than require project-specific fixes or edits to valid architecture. Replace independent spacing assumptions with shared geometric requirements derived from the visible connections, preserving the existing architecture and supported map behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Placement reserves the port and corridor space required by visible connection demand, including actors, external systems, component roofs and enclosing surfaces.
- [x] #2 Routing uses the same clearance and lane requirements as placement; increasing connection demand grows the required map space rather than squeezing ports or fixed exits together.
- [x] #3 The supported complete placement-to-routing flow retains all visible relationships, attached orthogonal routes, building clearance and distinct parallel paths without mutating architecture data.
- [x] #4 Remove obsolete fixed route-space expansion and redundant spacing rules; document the shared layout responsibility and verify focused layout invariants plus the repository check.
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
1. Use route-space.ts for plane units, physical lane width, wall capacity, and route reach. 2. Count visible connections before packing; size building and surface ports, reserve roof-aware envelopes, and preserve local corridor demand and direct system port capacity through composition. 3. Allocate full-width grid lanes and reserve port turning areas before sequential route search. 4. Verify complete-flow geometry, world immutability, the reported cloned architecture, browser and terminal use, and bun run check. 5. Complete cold simplicity review, one targeted re-review, implementer specification and quality reviews, and final full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The initial crowded parallel-route check exposed a second spacing assumption: distinct grid edges could still draw overlapping strokes. Route allocation now accounts for physical lane width and protects turning room for ports that have not yet been routed. This complements demand-sized placement rather than catching failures and retrying.

Cold simplicity review identified missing capacity on direct surface endpoints and overly broad composed-system demand. Both were corrected. Its one targeted re-review identified composition shrinking an enclosing system below its own port minimum. That minimum and clearance are now preserved. Focused verification covers 64 connections to empty systems and containers, 96 direct system connections combined with a mediator flow, crowded actor/component/external connections, and dense siblings.

Specification and quality self-reviews passed. The final full-context complexity review found no blockers or materially simpler implementation within scope. The claim is demand-based prevention of the identified spacing failures, not a mathematical guarantee for every graph; sequential path search and its safety checks remain.

Final bun run check passed: 16 Node tests, 300 Bun tests, six optional native cases skipped. The working tree also contains unrelated TASK-377 work included in that run. Log: /tmp/groma-378-check.log. All changed source/test files remain below 500 lines; Biome reports no new complexity warnings. No data model, scanner, dependency, fallback, retry or release infrastructure was added.

The final code opened the isolated clone with all 116 relationships represented by 116 routes. Browser inspection checked isometric and 2D container views. tui-test checked root/details navigation at 120x36 and a container at 200x60; screenshots: /tmp/groma-378-tui.svg and /tmp/groma-378-tui-container.svg. A wait for a guessed Backspace footer label timed out, but the captured state showed the container had opened; this was a validation-script expectation, not an application failure. Windows runtime verification and publishing were not performed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Placement and routing now share connection-demand geometry: walls grow for ports, roof-aware envelopes reserve turning and corridor space, and composition preserves those requirements. Routing allocates physical stroke lanes and protects later ports before drawing. Removed fixed percentage expansion and the separate hub-size threshold. Verified crowded and dense complete flows, direct and composed surface endpoints, unchanged architecture, the 116-route cloned map, browser/TUI use, required reviews and the full repository check. Not published.
<!-- SECTION:FINAL_SUMMARY:END -->
