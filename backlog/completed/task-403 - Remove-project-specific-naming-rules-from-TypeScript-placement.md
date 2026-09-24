---
id: TASK-403
title: Remove project-specific naming rules from TypeScript placement
status: Done
assignee:
  - '@codex'
created_date: '2026-09-15 14:00'
updated_date: '2026-09-16 19:23'
labels:
  - scanner
  - typescript
dependencies: []
references:
  - typescript-src-index
documentation:
  - docs/scanners/creating-a-plugin.md
  - docs/component-markdown.md
modified_files:
  - plugins/scanners/typescript/src/scan.ts
  - test/fixtures/typescript-placement.json
  - test-bun/typescript-placement.test.ts
priority: high
type: bug
ordinal: 449000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TypeScript scanner excludes scope candidates when a path contains atoms, molecules, or organisms, a file is named paint, or an exported symbol starts with draw. The same filter treats a file named types specially. These naming conventions do not establish application boundaries in arbitrary TypeScript projects: a draw operation may belong to a lottery or financial application, and a types file may contain executable code. Groma's own repository must not be a template for the architecture of scanned projects.

Remove these name-based placement exceptions without replacing them with another project vocabulary or a special case for the Groma repository. The approved behavior is that these names receive the same placement treatment as neutral names with equivalent source structure. This is a bounded correction to the current scanner, not approval to redesign all scope inference. Language syntax and explicit project declarations remain evidence; architectural meaning is curated by humans and agents.

The scanner continues to return temporary source evidence. Core owns C4 identities and containment, while ordinary OKF Code links retain readable source ownership. The correction requires no new C4 level, stored metadata, or changes to curated architecture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TypeScript placement no longer excludes or promotes files because their folders are named atoms, molecules, or organisms, their stems are paint or types, or their symbol names begin with draw. No replacement list of application vocabulary or Groma-specific exception is introduced.
- [x] #2 A minimal independent TypeScript fixture demonstrates that changing neutral folder, file, and symbol names to each formerly special name leaves inferred scope membership equivalent after accounting for renamed paths, with import topology, folder depth, and explicit project declarations unchanged and no ambiguous tie deciding placement.
- [x] #3 The supported fixture retains source inventory and declaration/operation evidence. A repeated scan preserves existing component ownership and human or agent curation rather than moving curated components to newly inferred placements.
- [x] #4 Validation uses test/fixtures and a temporary project, not the live Groma architecture as expected output. Obsolete tests or documentation that require these naming exceptions are corrected, and focused scanner checks plus bun run check pass.
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
1. Remove name-based scope exclusions while retaining existing import/project inference. 2. Verify equivalent renamed fixture graphs, evidence retention, and curated repeat scans. 3. Run focused and repository checks and review the bounded correction.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed all vocabulary exclusions from existing scope inference. Six concurrent renamed-graph cases preserve membership, declarations, operations and curated repeat scans; nine focused tests passed. Full check passed: 338 Bun, 17 optional skips, 16 Node. No obsolete scanner documentation or tests require the removed rules. Implementer specification and quality reviews passed; bounded deletion adds no architecture concepts.

Commit separation: the production removal of naming exceptions was already included in published commit 1c91ffd0 for TASK-407. The separate TASK-403 commit contains its naming-independence fixture, tests and task record. TASK-407 adjusted the shared test expectation to keep the helper in main.ts; the combined twelve TypeScript tests pass. Existing published history is preserved.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed project-specific TypeScript placement rules. Equivalent neutral and formerly special names now have the same scope membership, verified by independent fixtures, repeat-scan curation and the full repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
