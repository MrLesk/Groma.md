---
id: TASK-422
title: Stop warning about curated multi-file components
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-17 06:29'
labels: []
dependencies: []
references:
  - scan-source-units
  - src-scanner
modified_files:
  - src/scan-source-units.ts
  - test-bun/scan-source-units.test.ts
  - docs/scanners/evidence.md
  - docs/scanners/dotnet-csharp/index.md
  - docs/component-markdown.md
  - src/scan-reconciler.ts
type: bug
ordinal: 488000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every scan reports `unconfirmed-source-unit-membership` for each curated component whose files a scanner does not declare as one source unit (`src/scan-source-units.ts`). Groma keeps no history of earlier scanner groupings, so the warning fires for every hand-combined component on every scan, although curated ownership is authoritative and is retained anyway. callforpapers gets 65 of these warnings per scan.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Scans no longer report a warning because a curated component contains files that no single scanner source unit covers.
- [x] #2 Overlapping source units and a source unit whose files have different owners are still reported.
- [x] #3 Scanner documentation describes only the remaining conflicts; focused tests cover curated components without warnings.
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
1. src/scan-source-units.ts: delete unsupportedMembership and its unconfirmed-source-unit-membership warning. sourceUnitGroups keeps the two remaining checks (shared-source-unit-file, conflicting-source-unit-owners) and returns each surviving unit with its single existing owner, if any.
2. src/scan-reconciler.ts: associateCandidates uses that returned owner instead of deriving it again.
3. test-bun/scan-source-units.test.ts: assert that a manually combined component, an association that disappears, and a companion the scanner stops inventorying all keep ownership with no evidence conflicts; keep the existing overlap and different-owner assertions. The fixture helper always passes a unit list.
4. Docs describing the removed warning: docs/scanners/evidence.md, docs/scanners/dotnet-csharp/index.md, docs/component-markdown.md. docs/scanners/index.md, vue and angular pages only mention the remaining conflicts and stay unchanged.
5. Run focused tests, then bun run check in an isolated worktree.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed unsupportedMembership from src/scan-source-units.ts. The owner map now carries only the id that the two remaining checks read: shared-source-unit-file for overlapping units, and conflicting-source-unit-owners for a unit whose files have different owners.
Tests (test-bun/scan-source-units.test.ts): a manual combine rescanned with a narrower unit, an association replaced by an empty unit list, and a companion dropped from inventory each keep ownership and return no evidence conflicts. Those three assertions failed against the previous source in an isolated worktree. The overlap and different-owner assertions are unchanged and pass. A case that omitted sourceUnits was removed because omitted and empty units no longer behave differently.
Docs: evidence.md, dotnet-csharp/index.md and component-markdown.md no longer describe the removed warning. index.md and the Vue and Angular pages mention only the remaining conflicts and stay unchanged. creating-a-plugin.md was not edited (uncommitted TASK-410 changes).
Verification: bun test test-bun/scan-source-units.test.ts passed 7 of 7. Isolated bun run check exited 0 (Biome: one pre-existing complexity warning in test-bun/iso-map.test.ts; Node tests 16 passed; Bun tests 364 passed, 17 skipped, 0 failed).
Non-blocking follow-up: core no longer distinguishes omitted from empty sourceUnits. The "omit vs empty array" guidance is now inert at docs/scanners/creating-a-plugin.md lines 80-81 and in the packages/scanner/src/index.ts sourceUnits comment (line 75). Both files have uncommitted TASK-410 changes, so they were left unchanged.

Cold review, all findings optional, all five applied without new behavior: sourceUnitGroups docstring rewritten; parameter renamed to ownerByFile; sourceUnitGroups now returns each surviving unit with its single existing owner, which associateCandidates in src/scan-reconciler.ts uses instead of re-deriving it with [0]; the test helper always passes a unit list (empty for the second scanner); the sentence in docs/component-markdown.md that repeated the curated-membership rule was deleted and the paragraph rewrapped.
Rerun: focused tests 7 of 7; isolated bun run check exited 0 (Bun tests 364 passed, 17 skipped, 0 failed; Node tests 16 passed; Biome findings only in files this task does not touch).
Pending: docs/scanners/creating-a-plugin.md and packages/scanner/src/index.ts still have uncommitted TASK-410 changes, so their omit-vs-empty sourceUnits guidance is unchanged until the coordinator decides.

Handoff: the coordinator assigned removal of the stale omit-vs-empty sourceUnits guidance (docs/scanners/creating-a-plugin.md lines 80-81 and the sourceUnits comment in packages/scanner/src/index.ts) to TASK-410, which is already rewriting both files. TASK-422 commits without them.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scans no longer warn when a curated component owns files that no single scanner source unit covers. The unconfirmed-source-unit-membership check fired for every hand-combined component on every scan, even though curated ownership is authoritative and always retained, so it was deleted from src/scan-source-units.ts. The two real conflicts are still reported: overlapping source units (shared-source-unit-file) and a unit whose files have different existing owners (conflicting-source-unit-owners). sourceUnitGroups now returns each unit it keeps together with that unit's single existing owner, and associateCandidates in src/scan-reconciler.ts uses that owner instead of looking it up again. Docs updated: docs/scanners/evidence.md, docs/scanners/dotnet-csharp/index.md, docs/component-markdown.md. Verification: test-bun/scan-source-units.test.ts asserts no evidence conflicts for a manual combine, a disappeared association and a companion dropped from inventory. These assertions failed against the previous source. The existing overlap and different-owner assertions still pass (7 of 7). Isolated bun run check exited 0 (Bun tests 364 passed, 17 skipped, 0 failed; Node tests 16 passed). Follow-up: TASK-410 removes the now-stale omit-vs-empty sourceUnits guidance.
<!-- SECTION:FINAL_SUMMARY:END -->
