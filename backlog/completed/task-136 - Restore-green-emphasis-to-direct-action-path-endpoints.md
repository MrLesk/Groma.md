---
id: TASK-136
title: Restore green emphasis to direct action path endpoints
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 13:55'
updated_date: '2026-08-23 21:14'
labels: []
dependencies: []
references:
  - iso-map
modified_files:
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - docs/viewers/web/index.md
type: bug
ordinal: 147000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web viewer correctly animates and dims a selected person-command path, but the buildings and other architecture elements directly connected by its lit routes remain grey. Restore the visual contract from TASK-75: direct route endpoints carry the Groma accent, contextual ancestors remain neutral and fully visible, and unrelated elements stay faded.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 While a person command is active, every source and target of a lit route carries the map's semantic lit state and is visibly accented
- [x] #2 Containing slabs and system islands remain neutral context unless a lit route directly connects to them
- [x] #3 Unrelated elements remain faded during the trace, and clearing the command restores the normal map
- [x] #4 Focused checks, typecheck, and rendered web verification pass
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
1. In `IsoMap.setFlow()`, derive `litEndpointIds` from the already authoritative `litRouteIds` and toggle one semantic `lit` class on map items; keep `onpath` only for contextual visibility and fading.
2. Extend the shared map state styling so lit items use the existing accent outline and name treatment without changing slab or island fills.
3. Document the distinction between direct accented endpoints and neutral contextual ancestors.
4. Run focused tests and typecheck, then exercise Human architect -> Runs a scan in the browser and confirm direct endpoints, neutral ancestors, fading, clearing, and console health.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the flow state in `IsoMap.setFlow()`: each lit route keeps its route `lit` class and contributes its source and target to one derived `litEndpointIds` set. Map items toggle the same semantic `lit` state from that set, while `onpath` remains the independent contextual visibility state. Shared CSS accents only lit buildings, slabs and islands, so the route emphasis ladder is unchanged. The web viewer contract now records the direct-endpoint versus contextual-ancestor distinction.

Focused verification: `bun test --timeout 20000 test-bun/action-path.test.ts test-bun/iso-map.test.ts` passed 16 tests; `bun run typecheck` passed. The Browser plugin could not initialize because its runtime import of `node:process` is blocked in the browser control session, so rendered verification reused the already accepted headless Playwright path. On Human architect -> Runs a scan, 9 routes and exactly 10 direct endpoints were lit; Groma, CLI, Scanner and Core remained on-path but neutral; an unrelated slab computed to opacity 0.3; `x` cleared all lit/on-path state; console warnings and errors were empty. Screenshot: `/tmp/groma-path-selection-after.png`.

The cold simplicity review and the full-context defensive architecture review both kept the single derived endpoint set and rejected a new module or atom. The final review asked for clearer route-ID and endpoint-ID names plus the durable documentation rule; both were applied.

Post-review verification passed again: 16 focused tests, TypeScript, `git diff --check`, and the 1600x900 rendered interaction on the freshly started server. The full `bun run test` command is not green because `test/scan-watch.test.ts` fails its existing `folds.length >= 1` assertion; the standalone rerun fails the same way. That test exercises architecture watching and does not import or touch this task's web map files, so it is recorded as an unrelated repository failure rather than expanded into this task.

Commit-time verification on local main passed again: 20 focused action-path and iso-map tests, TypeScript, and git diff checks.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restored the web action-path contract: `IsoMap.setFlow()` now derives direct endpoint IDs from its authoritative lit routes, map styling accents only those endpoint outlines and names, contextual ancestors remain neutral, and off-path elements keep their dimming. Documented the rule so future map changes preserve the distinction. Verified Human architect -> Runs a scan with 9 lit routes, 10 accented endpoints, 4 neutral contextual ancestors, 0.3 off-path opacity, clean clearing and no console errors; 16 focused tests, TypeScript, and diff checks pass. Cold and full-context architecture reviews found the design simple and defensive after the naming and documentation clarifications.
<!-- SECTION:FINAL_SUMMARY:END -->
