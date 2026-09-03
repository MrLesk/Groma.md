---
id: TASK-242
title: Remove missing files from scanned Code
status: Done
assignee:
  - '@codex'
created_date: '2026-09-03 18:16'
updated_date: '2026-09-03 18:29'
labels:
  - scanner
  - core
dependencies: []
references:
  - scan-lifecycle
modified_files:
  - src/scan-reconciler.ts
  - test-bun/scanner-evidence.test.ts
  - groma/systems/groma/containers/web-viewer/components/source-viewer.md
  - groma/systems/groma/containers/web-viewer/components/task-diff.md
  - test-bun/okf-writers.test.ts
priority: high
type: bug
ordinal: 281000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a source file is moved or deleted, a later scan must stop showing its old path in the owning architecture component. Existing files and the component's authored meaning remain unchanged. This lets code moves be curated through Groma without stale or duplicate ownership.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A successful scan removes a Code reference whose exact repository file no longer exists for a scanner that ran
- [x] #2 The same component keeps existing Code references, authored meaning, grouping and relationships
- [x] #3 A moved file can be curated at its new path without the old path remaining in How it is built
- [x] #4 Tests cover removing a missing reference beside a retained existing reference
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
1. Update curated-code refresh to distinguish current evidence, retained existing files, and physically missing files for scanners that ran.\n2. Reuse the existing Code frontmatter writer so only the Code list changes and authored architecture content stays intact.\n3. Add a scanner-evidence fixture with one retained file and one missing file in a grouped, related component.\n4. Run focused scanner tests and the full repository check.\n5. Run the required simplicity, specification, quality, and full-context complexity reviews before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the defensive boundary discovered by focused tests: a missing path is pruned only when the same component has current evidence from that scanner. This preserves wholly unobserved responsibilities. Focused scanner and OKF writer tests pass 16/16. Two live scans remove the four stale web reader/diff paths and create no replacement components.

Full-context review caught that the first guard required a surviving sibling Code file and therefore missed a component whose only file moved. Replaced it with the simpler per-reference rule: refresh current evidence; remove an absent file when its scanner ran; preserve other references; write only touched components. Added the single-file case and made the shared OKF fixture internally consistent by creating its referenced source file. Focused tests pass 16/16 with 122 expectations.

Final verification: focused scanner and OKF writer tests pass 16/16 (122 expectations); typecheck and focused Biome lint pass; bun run check passes 106 Node and 264 Bun tests. The full-context blocker was fixed and re-reviewed by the implementer against that finding and its regressions. The task changes only scanner reconciliation, its fixtures, and the two architecture Code lists produced by the verified live scan.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A successful scan now removes stale Code paths per reference when that scanner ran and the repository file is absent, while preserving valid Code references and authored architecture. Verified with retained-plus-missing and only-missing regression cases, two live scans of the moved web readers, and the complete repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
