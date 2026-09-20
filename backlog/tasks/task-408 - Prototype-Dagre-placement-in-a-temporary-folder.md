---
id: TASK-408
title: Prototype Dagre placement in a temporary folder
status: Done
assignee:
  - '@codex'
created_date: '2026-09-16 10:24'
updated_date: '2026-09-16 18:28'
labels: []
dependencies: []
type: spike
ordinal: 454000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Evaluate whether Dagre can simplify Groma placement through a runnable visual comparison, isolated from product code and dependencies.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A temporary-folder prototype shows the same existing architecture with current placement and Dagre placement.
- [x] #2 The comparison preserves Groma measurements and routing and reports any observed limitations.
- [x] #3 The prototype includes run instructions and has been opened and checked in a browser.
- [x] #4 Externally accessed children and their containing groups stay on the west side in the Dagre prototype, including the Command interface, while all original relationships remain routed.
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
Use the frozen architecture and source snapshot in /tmp/groma-dagre-JYhb1d. Place externally fed child envelopes in a west column at every nested surface; use Dagre for remaining connected siblings and shelf packing for unrelated children. Keep original measurements, outer island layout, router, and renderer. Build the comparison, verify the entry rule with a generic fixture and the CLI/group positions in the snapshot, inspect the browser, and document measured tradeoffs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Prototype workspace: /tmp/groma-dagre-JYhb1d. Captured world.json (110 elements, 55 relationships), project.json, and a private source snapshot. Product source, architecture records, and repository dependencies remain unchanged. Temporary files are outside the repository, so no repository-relative modified-file entries apply.

Built and opened http://127.0.0.1:4318/. Both variants render 110 elements and route all 55 relationships; original route safety checks pass, and build confirms world immutability. Browser checked current/Dagre switching, container focus, isometric/top-down projection, zoom, pan, and selection. README.md records run instructions, metric definitions, and limitations. Initial Dagre map area +85.7%, arrow length +78.5%, bends 135 versus 146. Single-run timing is explicitly not a benchmark. Repository bun run check passed (346 Bun tests passed, 17 skipped, no failures; Node suite and typecheck passed). Implementer scope, quality, and simplicity review: bounded isolated experiment, 40-line adapter, no product architecture or API changes; no blocking findings. All prototype sources and dependencies remain outside the repository.

Approved entry-point revision: updated temporary dagre-pack.ts and README.md, added a generic fixture and entry-placement test, rebuilt generated assets. No repository source files changed. Entry envelopes now occupy a west column; incoming callbacks remain routed but cannot affect their rank. Both current and revised layouts place the application at x=45, Project commands at x=52, and Command interface at x=57.25. All 55 routes pass existing safety checks. Revised Dagre area 99690.75 versus current 124087.5; arrow length 5003 versus 4061; bends 174 versus 146. Focused concurrent fixture test passed 17 assertions covering west placement despite callbacks, non-overlap, determinism, and input immutability. Preview reloaded with new metrics and inspected. Sandbox repository check was blocked by FSEvents, process, and local-server restrictions; rerun outside the sandbox passed (346 Bun tests, 17 skipped). Implementer specification, quality, and simplicity review found no blocking issues in the bounded temporary change.

Decision: Alex rejected the visual result and asked to drop Dagre. The experiment is closed without adoption. Stopped the prototype preview server. Groma retains its existing layout; no Dagre dependency or implementation was added to product code.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Evaluated Dagre in an isolated temporary prototype and rejected it after visual review with Alex. Groma keeps its existing layout. The preview server is stopped. The experiment changed no product source or dependencies.
<!-- SECTION:FINAL_SUMMARY:END -->
